from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/pharmacies", tags=["pharmacies"])


class PharmacyCreate(BaseModel):
    name: str
    phone: str | None = None
    notes: str | None = None


class PharmacyUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    notes: str | None = None


class PharmacyOut(BaseModel):
    id: UUID
    name: str
    phone: str | None
    notes: str | None


@router.get("", response_model=list[PharmacyOut])
async def list_pharmacies(
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[PharmacyOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, name, phone, notes from pharmacies where tenant_id = $1 order by name limit $2 offset $3",
            current.tenant_id,
            limit,
            offset,
        )
    return [PharmacyOut(**dict(row)) for row in rows]


@router.post("", response_model=PharmacyOut, status_code=201)
async def create_pharmacy(
    payload: PharmacyCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> PharmacyOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "insert into pharmacies (tenant_id, name, phone, notes) values ($1, $2, $3, $4) "
            "returning id, name, phone, notes",
            current.tenant_id,
            payload.name,
            payload.phone,
            payload.notes,
        )
    return PharmacyOut(**dict(row))


@router.patch("/{pharmacy_id}", response_model=PharmacyOut)
async def update_pharmacy(
    pharmacy_id: UUID, payload: PharmacyUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> PharmacyOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [pharmacy_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"update pharmacies set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 "
            "returning id, name, phone, notes",
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Farmácia não encontrada")
    return PharmacyOut(**dict(row))


@router.delete("/{pharmacy_id}", status_code=204)
async def delete_pharmacy(
    pharmacy_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from pharmacies where id = $1 and tenant_id = $2", pharmacy_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Farmácia não encontrada")
