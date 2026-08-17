import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field

from app.core import db, storage
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(tags=["public-profile"])

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
BIO_MAX_LENGTH = 800


class PublicProfileUpdate(BaseModel):
    public_slug: str | None = None
    # 800 chars: os modelos prontos (apps/web/lib/bioTemplates.ts) ficam em ~460 e
    # sobra folga pra personalizar. A coluna não tem limite; o limite é aqui e no
    # maxLength do textarea, porque esse texto vai pro <p> de uma página pública.
    bio: str | None = Field(default=None, max_length=BIO_MAX_LENGTH)
    public_booking_enabled: bool | None = None
    # photo_url NÃO entra aqui de propósito: o SET do PATCH é montado dinamicamente a
    # partir das chaves deste modelo, então incluí-la deixaria qualquer cliente
    # autenticado apontar a foto pública pra URL arbitrária de terceiros. Foto só muda
    # por POST/DELETE /me/public-profile/photo.


class PublicProfileOut(BaseModel):
    public_slug: str | None
    bio: str | None
    public_booking_enabled: bool
    photo_url: str | None


class PublicPageOut(BaseModel):
    name: str
    bio: str | None
    photo_url: str | None


class BookingRequestCreate(BaseModel):
    patient_name: str
    patient_email: EmailStr | None = None
    patient_phone: str | None = None
    requested_at: datetime
    message: str | None = None


@router.get("/me/public-profile", response_model=PublicProfileOut)
async def get_my_public_profile(current: CurrentProfessional = Depends(get_current_professional)) -> PublicProfileOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "select public_slug, bio, public_booking_enabled, photo_url from professionals where id = $1",
            current.professional_id,
        )
    return PublicProfileOut(**dict(row))


@router.patch("/me/public-profile", response_model=PublicProfileOut)
async def update_my_public_profile(
    payload: PublicProfileUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> PublicProfileOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    if "public_slug" in fields and fields["public_slug"]:
        if not SLUG_RE.match(fields["public_slug"]):
            raise HTTPException(
                status_code=422, detail="Slug só pode ter letras minúsculas, números e hífen (ex: joice-nutri)"
            )
    set_clauses = []
    params: list = [current.professional_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        try:
            row = await conn.fetchrow(
                f"""
                update professionals set {', '.join(set_clauses)}
                where id = $1
                returning public_slug, bio, public_booking_enabled, photo_url
                """,
                *params,
            )
        except Exception as exc:  # noqa: BLE001
            if "unique" in str(exc).lower():
                raise HTTPException(status_code=409, detail="Esse link já está em uso por outro profissional")
            raise
    return PublicProfileOut(**dict(row))


@router.get("/public/{slug}", response_model=PublicPageOut)
async def get_public_page(slug: str) -> PublicPageOut:
    async with db.pool().acquire() as conn:
        row = await conn.fetchrow(
            """
            select name, bio, photo_url from professionals
            where public_slug = $1 and public_booking_enabled = true
            """,
            slug,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Página não encontrada")
    return PublicPageOut(**dict(row))


@router.post("/me/public-profile/photo", response_model=PublicProfileOut)
async def upload_my_photo(
    file: UploadFile = File(...),
    current: CurrentProfessional = Depends(get_current_professional),
) -> PublicProfileOut:
    if not storage.is_configured():
        raise HTTPException(status_code=503, detail="Upload de foto não está configurado neste ambiente")
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

    try:
        normalized = storage.normalize_avatar(b"".join(chunks))
    except storage.InvalidImageError:
        raise HTTPException(status_code=415, detail="Não consegui ler essa imagem. Tente um JPG ou PNG.")

    try:
        new_url = await storage.put_avatar(current.professional_id, normalized)
    except Exception as exc:  # noqa: BLE001
        print(f"[public_profile] falha ao subir foto: {exc}")  # noqa: T201
        raise HTTPException(status_code=502, detail="Não foi possível salvar a foto agora. Tente de novo.")

    async with db.tenant_connection(current.tenant_id) as conn:
        old_url = await conn.fetchval("select photo_url from professionals where id = $1", current.professional_id)
        row = await conn.fetchrow(
            """
            update professionals set photo_url = $2 where id = $1
            returning public_slug, bio, public_booking_enabled, photo_url
            """,
            current.professional_id,
            new_url,
        )

    # Best-effort e depois do commit: se falhar, sobra objeto órfão (frações de
    # centavo) em vez de a linha apontar pra objeto que não existe mais.
    await storage.delete_by_public_url(old_url)
    return PublicProfileOut(**dict(row))


@router.delete("/me/public-profile/photo", response_model=PublicProfileOut)
async def delete_my_photo(
    current: CurrentProfessional = Depends(get_current_professional),
) -> PublicProfileOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        old_url = await conn.fetchval("select photo_url from professionals where id = $1", current.professional_id)
        row = await conn.fetchrow(
            """
            update professionals set photo_url = null where id = $1
            returning public_slug, bio, public_booking_enabled, photo_url
            """,
            current.professional_id,
        )

    await storage.delete_by_public_url(old_url)
    return PublicProfileOut(**dict(row))


@router.post("/public/{slug}/booking-requests", status_code=201)
async def create_booking_request(slug: str, payload: BookingRequestCreate) -> dict:
    async with db.pool().acquire() as conn:
        professional = await conn.fetchrow(
            "select id, tenant_id from professionals where public_slug = $1 and public_booking_enabled = true",
            slug,
        )
        if professional is None:
            raise HTTPException(status_code=404, detail="Página não encontrada")

        request_id = await conn.fetchval(
            """
            insert into booking_requests
                (tenant_id, professional_id, patient_name, patient_email, patient_phone, requested_at, message)
            values ($1, $2, $3, $4, $5, $6, $7)
            returning id
            """,
            professional["tenant_id"],
            professional["id"],
            payload.patient_name,
            payload.patient_email,
            payload.patient_phone,
            payload.requested_at,
            payload.message,
        )
    return {"id": str(request_id), "status": "pending"}
