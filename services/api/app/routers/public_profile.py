import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(tags=["public-profile"])

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class PublicProfileUpdate(BaseModel):
    public_slug: str | None = None
    bio: str | None = None
    public_booking_enabled: bool | None = None


class PublicProfileOut(BaseModel):
    public_slug: str | None
    bio: str | None
    public_booking_enabled: bool


class PublicPageOut(BaseModel):
    name: str
    bio: str | None


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
            "select public_slug, bio, public_booking_enabled from professionals where id = $1",
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
                returning public_slug, bio, public_booking_enabled
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
            "select name, bio from professionals where public_slug = $1 and public_booking_enabled = true",
            slug,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Página não encontrada")
    return PublicPageOut(**dict(row))


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
