from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/locations", tags=["locations"])


class LocationCreate(BaseModel):
    name: str
    kind: Literal["in_person", "video"] = "in_person"
    address: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    kind: Literal["in_person", "video"] | None = None
    address: str | None = None


class LocationOut(BaseModel):
    id: UUID
    name: str
    kind: str
    address: str | None


@router.get("", response_model=list[LocationOut])
async def list_locations(
    current: CurrentProfessional = Depends(get_current_professional),
) -> list[LocationOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, name, kind, address from locations where tenant_id = $1 order by name",
            current.tenant_id,
        )
    return [LocationOut(**dict(row)) for row in rows]


@router.post("", response_model=LocationOut, status_code=201)
async def create_location(
    payload: LocationCreate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> LocationOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "insert into locations (tenant_id, name, kind, address) values ($1, $2, $3, $4) "
            "returning id, name, kind, address",
            current.tenant_id,
            payload.name,
            payload.kind,
            payload.address,
        )
    return LocationOut(**dict(row))


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    location_id: UUID, payload: LocationUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> LocationOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [location_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"update locations set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 "
            "returning id, name, kind, address",
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Local não encontrado")
    return LocationOut(**dict(row))


@router.delete("/{location_id}", status_code=204)
async def delete_location(location_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from locations where id = $1 and tenant_id = $2", location_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Local não encontrado")
