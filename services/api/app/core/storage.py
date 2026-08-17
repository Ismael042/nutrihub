"""Cloudflare R2 — armazenamento da foto de perfil da página pública.

Mesmo padrão do app/core/email.py: módulo fino embrulhando um serviço externo,
dirigido por config, sem vazar detalhe de cliente pros routers.
"""

import asyncio
import io
import uuid
from typing import Any

from app.core.config import settings

MAX_UPLOAD_BYTES = 3 * 1024 * 1024
ACCEPTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
AVATAR_MAX_SIDE = 512
JPEG_QUALITY = 85

_client: Any = None


class InvalidImageError(Exception):
    """Bytes recebidos não são uma imagem que a gente consiga abrir/normalizar."""


def is_configured() -> bool:
    return all(
        [
            settings.r2_account_id,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket,
            settings.r2_public_base_url,
        ]
    )


def _get_client() -> Any:
    """Cliente S3 apontado pro R2, criado sob demanda.

    O import do boto3 fica aqui dentro de propósito: tests/conftest.py importa
    app.main no topo do arquivo, então um import global derrubaria a coleta da
    suíte inteira numa máquina sem boto3 instalado.
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


def normalize_avatar(data: bytes) -> bytes:
    """Valida e re-encoda a imagem: 512px no maior lado, JPEG, sem metadado.

    O re-encode é o ponto principal de segurança aqui, não só de tamanho: descarta
    o EXIF (foto de celular carrega coordenada de GPS, e isso iria pra uma página
    pública sem autenticação), garante que o objeto servido é imagem de verdade e
    não um arquivo poliglota, e evita imagem gigante derrubando a página.
    """
    from PIL import Image, UnidentifiedImageError

    # Bomba de descompressão: imagem pequena no disco que explode em memória.
    Image.MAX_IMAGE_PIXELS = 40_000_000

    try:
        with Image.open(io.BytesIO(data)) as img:
            img.load()
            # Achata transparência (PNG/WebP) num fundo branco antes de virar JPEG,
            # senão o canal alfa vira preto.
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGBA")
                flattened = Image.new("RGB", img.size, (255, 255, 255))
                flattened.paste(img, mask=img.split()[-1])
                img = flattened
            else:
                img = img.convert("RGB")

            img.thumbnail((AVATAR_MAX_SIDE, AVATAR_MAX_SIDE))

            out = io.BytesIO()
            img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            return out.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise InvalidImageError(str(exc)) from exc


async def put_avatar(professional_id: Any, data: bytes) -> str:
    """Sobe a foto e devolve a URL pública.

    Chave nova a cada upload (nunca sobrescreve): o uuid4 no nome deixa o objeto
    não-enumerável e, como a URL muda a cada troca, dá pra marcar o objeto como
    immutable no cache sem precisar de cache-busting.
    """
    key = f"avatars/{professional_id}/{uuid.uuid4().hex}.jpg"
    client = _get_client()
    # boto3 é bloqueante — sem o to_thread, um write lento no R2 trava o event loop
    # pra todas as outras requisições da API.
    await asyncio.to_thread(
        client.put_object,
        Bucket=settings.r2_bucket,
        Key=key,
        Body=data,
        ContentType="image/jpeg",
        CacheControl="public, max-age=31536000, immutable",
    )
    return f"{settings.r2_public_base_url.rstrip('/')}/{key}"


async def delete_by_public_url(url: str | None) -> None:
    """Apaga o objeto correspondente a uma URL pública. Best-effort, nunca levanta.

    Só age se a URL pertencer ao bucket configurado agora — se a base pública mudar
    depois, objeto antigo fica órfão (custa frações de centavo) em vez de arriscar
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
