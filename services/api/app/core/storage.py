"""Cloudflare R2 — armazenamento de imagens.

Mesmo padrão do app/core/email.py: módulo fino embrulhando um serviço externo,
dirigido por config, sem vazar detalhe de cliente pros routers.

Dois buckets, com regra clara de qual usar:

- **Público** (`r2_bucket`, servido por `r2_public_base_url`): só o que é renderizado
  numa página pública, sem autenticação. Hoje: a foto de perfil do profissional.
  Guarda a URL completa no banco (ver migration 0018).
- **Privado** (`r2_private_bucket`): todo o resto — foto de paciente, foto de receita,
  logo do consultório. Sem domínio público; a leitura passa por URL assinada com
  expiração, gerada só depois da API conferir o acesso. Guarda a CHAVE no banco, e a
  URL é derivada na leitura (ver migration 0019).
"""

import asyncio
import io
import uuid
from typing import Any

from app.core.config import settings

MAX_UPLOAD_BYTES = 3 * 1024 * 1024
ACCEPTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
AVATAR_MAX_SIDE = 512
LOGO_MAX_SIDE = 600
JPEG_QUALITY = 85
PRESIGNED_TTL_SECONDS = 3600

_client: Any = None


class InvalidImageError(Exception):
    """Bytes recebidos não são uma imagem que a gente consiga abrir/normalizar."""


def is_configured() -> bool:
    """Bucket público configurado (foto de perfil do profissional)."""
    return all(
        [
            settings.r2_account_id,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket,
            settings.r2_public_base_url,
        ]
    )


def is_private_configured() -> bool:
    """Bucket privado configurado (foto de paciente/receita, logo)."""
    return all(
        [
            settings.r2_account_id,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_private_bucket,
        ]
    )


def _get_client() -> Any:
    """Cliente S3 apontado pro R2, criado sob demanda.

    O import do boto3 fica aqui dentro de propósito: tests/conftest.py importa
    app.main no topo do arquivo, então um import global derrubaria a coleta da
    suíte inteira numa máquina sem boto3 instalado.

    Um cliente só atende os dois buckets — mesma conta, mesma credencial, mesmo
    endpoint; o que muda é só o argumento Bucket= de cada chamada.
    """
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                # boto3 >= 1.36 manda checksum de integridade (x-amz-checksum-crc32) em
                # todo PutObject por padrão, e provedores S3-compatíveis respondem
                # NotImplemented. "when_required" volta ao comportamento antigo.
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )
    return _client


def _normalize(data: bytes, *, max_side: int, keep_alpha: bool) -> bytes:
    """Valida e re-encoda a imagem.

    O re-encode é o ponto principal de segurança, não só de tamanho: descarta o EXIF
    (foto de celular carrega coordenada de GPS), garante que o objeto guardado é
    imagem de verdade e não arquivo poliglota, e evita imagem gigante derrubando a
    página.

    keep_alpha: logo precisa de fundo transparente (PNG) — achatar num branco chapado
    fica feio no PDF. Foto vira JPEG, que é bem menor.
    """
    from PIL import Image, UnidentifiedImageError

    # Bomba de descompressão: imagem pequena no disco que explode em memória.
    Image.MAX_IMAGE_PIXELS = 40_000_000

    try:
        with Image.open(io.BytesIO(data)) as img:
            img.load()
            out = io.BytesIO()

            if keep_alpha:
                img = img.convert("RGBA")
                img.thumbnail((max_side, max_side))
                img.save(out, format="PNG", optimize=True)
                return out.getvalue()

            # Achata transparência (PNG/WebP) num fundo branco antes de virar JPEG,
            # senão o canal alfa vira preto.
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGBA")
                flattened = Image.new("RGB", img.size, (255, 255, 255))
                flattened.paste(img, mask=img.split()[-1])
                img = flattened
            else:
                img = img.convert("RGB")

            img.thumbnail((max_side, max_side))
            img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            return out.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise InvalidImageError(str(exc)) from exc


def normalize_avatar(data: bytes) -> bytes:
    """Foto redonda (perfil, paciente, receita): 512px no maior lado, JPEG."""
    return _normalize(data, max_side=AVATAR_MAX_SIDE, keep_alpha=False)


def normalize_logo(data: bytes) -> bytes:
    """Logo: 600px no maior lado, PNG — preserva proporção e transparência."""
    return _normalize(data, max_side=LOGO_MAX_SIDE, keep_alpha=True)


async def _put(bucket: str, key: str, data: bytes, content_type: str, cache_control: str | None) -> None:
    client = _get_client()
    kwargs: dict[str, Any] = {
        "Bucket": bucket,
        "Key": key,
        "Body": data,
        "ContentType": content_type,
    }
    if cache_control:
        kwargs["CacheControl"] = cache_control
    # boto3 é bloqueante — sem o to_thread, um write lento no R2 trava o event loop
    # pra todas as outras requisições da API.
    await asyncio.to_thread(client.put_object, **kwargs)


async def put_avatar(professional_id: Any, data: bytes) -> str:
    """Sobe a foto de perfil no bucket PÚBLICO e devolve a URL.

    Chave nova a cada upload (nunca sobrescreve): o uuid4 no nome deixa o objeto
    não-enumerável e, como a URL muda a cada troca, dá pra marcar o objeto como
    immutable no cache sem precisar de cache-busting.
    """
    key = f"avatars/{professional_id}/{uuid.uuid4().hex}.jpg"
    await _put(
        settings.r2_bucket,
        key,
        data,
        "image/jpeg",
        "public, max-age=31536000, immutable",
    )
    return f"{settings.r2_public_base_url.rstrip('/')}/{key}"


async def put_private(prefix: str, owner_id: Any, data: bytes, *, content_type: str = "image/jpeg") -> str:
    """Sobe no bucket PRIVADO e devolve a CHAVE (não a URL — ela é assinada na leitura).

    Sem CacheControl: o objeto é servido por URL assinada de vida curta, então cache
    de borda longo não faz sentido aqui.
    """
    ext = "png" if content_type == "image/png" else "jpg"
    key = f"{prefix}/{owner_id}/{uuid.uuid4().hex}.{ext}"
    await _put(settings.r2_private_bucket, key, data, content_type, None)
    return key


def presigned_get_url(key: str | None, expires_in: int = PRESIGNED_TTL_SECONDS) -> str | None:
    """URL assinada de leitura pra um objeto privado. None se não houver chave.

    Não é async de propósito: `generate_presigned_url` é HMAC local, sem chamada de
    rede — dá pra chamar dentro de list comprehension na serialização de uma lista
    sem custo perceptível.
    """
    if not key or not is_private_configured():
        return None
    try:
        return _get_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.r2_private_bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[storage] falha ao assinar URL de {key}: {exc}")  # noqa: T201
        return None


async def get_private_bytes(key: str | None) -> bytes | None:
    """Baixa um objeto privado. Usado pelo logo no PDF, que precisa dos bytes.

    Devolve None em qualquer falha em vez de levantar: quem chama (gerador de PDF)
    deve degradar pro layout sem logo, nunca quebrar o download.
    """
    if not key or not is_private_configured():
        return None
    try:
        client = _get_client()
        res = await asyncio.to_thread(client.get_object, Bucket=settings.r2_private_bucket, Key=key)
        return await asyncio.to_thread(res["Body"].read)
    except Exception as exc:  # noqa: BLE001
        print(f"[storage] falha ao baixar {key}: {exc}")  # noqa: T201
        return None


async def delete_private(key: str | None) -> None:
    """Apaga um objeto privado pela chave. Best-effort, nunca levanta."""
    if not key or not is_private_configured():
        return
    try:
        client = _get_client()
        await asyncio.to_thread(client.delete_object, Bucket=settings.r2_private_bucket, Key=key)
    except Exception as exc:  # noqa: BLE001
        print(f"[storage] falha ao apagar objeto privado {key}: {exc}")  # noqa: T201


async def delete_by_public_url(url: str | None) -> None:
    """Apaga o objeto do bucket público correspondente a uma URL. Best-effort.

    Só age se a URL pertencer ao bucket configurado agora — se a base pública mudar
    depois, objeto antigo fica órfão (frações de centavo) em vez de arriscar
    apagar a coisa errada.
    """
    if not url or not is_configured():
        return
    base = settings.r2_public_base_url.rstrip("/") + "/"
    if not url.startswith(base):
        return
    key = url[len(base) :]
    if not key:
        return
    try:
        client = _get_client()
        await asyncio.to_thread(client.delete_object, Bucket=settings.r2_bucket, Key=key)
    except Exception as exc:  # noqa: BLE001
        print(f"[storage] falha ao apagar objeto antigo {key}: {exc}")  # noqa: T201
