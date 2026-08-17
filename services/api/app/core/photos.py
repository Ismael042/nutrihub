"""Sequência compartilhada de upload de imagem privada.

A mesma coreografia se repete em patients/recipes/tenant_settings: validar tipo, ler
com teto de bytes, re-encodar, subir, trocar a chave no banco e apagar a antiga. Só o
SQL muda. Extraído pra não ter quatro cópias divergindo com o tempo.
"""

from typing import Any, Awaitable, Callable

from fastapi import HTTPException, UploadFile

from app.core import storage


async def read_upload(file: UploadFile) -> bytes:
    """Valida o tipo e lê o arquivo com teto de bytes. Levanta HTTPException."""
    if not storage.is_private_configured():
        raise HTTPException(status_code=503, detail="Upload de imagem não está configurado neste ambiente")
    if file.content_type not in storage.ACCEPTED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Envie uma imagem JPG, PNG ou WebP")

    # Lê em pedaços com teto: `await file.read()` sem limite deixaria o Starlette
    # fazer spool pra disco acima de 1 MB, virando vetor de encher disco.
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > storage.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Imagem muito grande — envie um arquivo de até 3 MB")
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(status_code=415, detail="Arquivo vazio")
    return b"".join(chunks)


async def read_attachment(file: UploadFile) -> bytes:
    """Igual ao read_upload, mas aceita PDF e tem teto maior (laudo escaneado).

    PDF não passa pelo re-encode do Pillow, então não ganha a garantia de "re-encodar
    prova que é imagem". Por isso o tipo é conferido pelos magic bytes, e não pelo
    header que o cliente mandou — e o objeto é gravado com o content_type que a API
    determinou, não com o alegado.
    """
    if not storage.is_private_configured():
        raise HTTPException(status_code=503, detail="Upload de arquivo não está configurado neste ambiente")
    if file.content_type not in storage.ACCEPTED_ATTACHMENT_TYPES:
        raise HTTPException(status_code=415, detail="Envie um PDF ou uma imagem JPG, PNG ou WebP")

    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > storage.MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=413, detail="Arquivo muito grande — envie até 10 MB")
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(status_code=415, detail="Arquivo vazio")
    return b"".join(chunks)


def sniff_attachment_type(data: bytes, claimed: str | None) -> str:
    """Determina o content_type pelos primeiros bytes. Levanta 415 se não bater.

    Nunca confia no header do cliente: é ele que define com que tipo o objeto vai ser
    servido depois pela URL assinada.
    """
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(status_code=415, detail="Arquivo não parece ser um PDF nem uma imagem válida")


async def replace_photo(
    raw: bytes,
    *,
    prefix: str,
    owner_id: Any,
    swap_key: Callable[[str | None], Awaitable[tuple[Any, str | None]]],
    as_logo: bool = False,
) -> Any:
    """Normaliza, sobe e troca a chave no banco, apagando a antiga.

    swap_key recebe a chave nova e devolve `(row, chave_antiga)` — quem chama é dono do
    SQL (cada tabela tem o seu). O delete da antiga acontece depois do commit e é
    best-effort: se falhar, sobra objeto órfão (frações de centavo) em vez de a linha
    apontar pra objeto que não existe mais.
    """
    try:
        normalized = storage.normalize_logo(raw) if as_logo else storage.normalize_avatar(raw)
    except storage.InvalidImageError:
        raise HTTPException(status_code=415, detail="Não consegui ler essa imagem. Tente um JPG ou PNG.")

    content_type = "image/png" if as_logo else "image/jpeg"
    try:
        new_key = await storage.put_private(prefix, owner_id, normalized, content_type=content_type)
    except Exception as exc:  # noqa: BLE001
        print(f"[photos] falha ao subir imagem ({prefix}/{owner_id}): {exc}")  # noqa: T201
        raise HTTPException(status_code=502, detail="Não foi possível salvar a imagem agora. Tente de novo.")

    row, old_key = await swap_key(new_key)
    await storage.delete_private(old_key)
    return row
