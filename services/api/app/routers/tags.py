from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/tags", tags=["tags"])


class TagCreate(BaseModel):
    name: str


class TagOut(BaseModel):
    id: UUID
    name: str


@router.get("", response_model=list[TagOut])
async def list_tags(
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[TagOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, name from tags where tenant_id = $1 order by name limit $2 offset $3",
            current.tenant_id,
            limit,
            offset,
        )
    return [TagOut(**dict(row)) for row in rows]


@router.post("", response_model=TagOut, status_code=201)
async def create_tag(
    payload: TagCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> TagOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "insert into tags (tenant_id, name) values ($1, $2) returning id, name",
            current.tenant_id,
            payload.name,
        )
    return TagOut(**dict(row))


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute("delete from tags where id = $1 and tenant_id = $2", tag_id, current.tenant_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Tag não encontrada")


@router.post("/{tag_id}/patients/{patient_id}", status_code=204)
async def attach_tag(
    tag_id: UUID, patient_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        tag = await conn.fetchval("select id from tags where id = $1 and tenant_id = $2", tag_id, current.tenant_id)
        if patient is None or tag is None:
            raise HTTPException(status_code=404, detail="Paciente ou tag não encontrados")
        await conn.execute(
            "insert into patient_tags (patient_id, tag_id) values ($1, $2) on conflict do nothing",
            patient_id,
            tag_id,
        )


@router.delete("/{tag_id}/patients/{patient_id}", status_code=204)
async def detach_tag(
    tag_id: UUID, patient_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        tag = await conn.fetchval("select id from tags where id = $1 and tenant_id = $2", tag_id, current.tenant_id)
        if patient is None or tag is None:
            raise HTTPException(status_code=404, detail="Paciente ou tag não encontrados")
        await conn.execute("delete from patient_tags where patient_id = $1 and tag_id = $2", patient_id, tag_id)
