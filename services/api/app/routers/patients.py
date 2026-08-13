from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/patients", tags=["patients"])

StatusFilter = Literal["active", "inactive", "all"]


class PatientCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None


class PatientUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    status: Literal["active", "inactive"] | None = None


class PatientOut(BaseModel):
    id: UUID
    name: str
    email: str | None
    phone: str | None
    birth_date: date | None
    status: str


class TagOut(BaseModel):
    id: UUID
    name: str


class DiaryEntryOut(BaseModel):
    id: UUID
    logged_at: str
    meal_kind: str | None
    description: str


@router.get("", response_model=list[PatientOut])
async def list_patients(
    current: CurrentProfessional = Depends(get_current_professional),
    status_filter: StatusFilter = Query("active", alias="status"),
    search: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[PatientOut]:
    conditions = ["tenant_id = $1"]
    params: list = [current.tenant_id]

    if status_filter != "all":
        params.append(status_filter)
        conditions.append(f"status = ${len(params)}")

    if search:
        params.append(f"%{search}%")
        conditions.append(f"name ilike ${len(params)}")

    params.extend([limit, offset])
    query = f"""
        select id, name, email, phone, birth_date, status
        from patients
        where {' and '.join(conditions)}
        order by name
        limit ${len(params) - 1} offset ${len(params)}
    """

    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)

    return [PatientOut(**dict(row)) for row in rows]


@router.post("", response_model=PatientOut, status_code=201)
async def create_patient(
    payload: PatientCreate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            insert into patients (tenant_id, name, email, phone, birth_date)
            values ($1, $2, $3, $4, $5)
            returning id, name, email, phone, birth_date, status
            """,
            current.tenant_id,
            payload.name,
            payload.email,
            payload.phone,
            payload.birth_date,
        )
    return PatientOut(**dict(row))


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "select id, name, email, phone, birth_date, status from patients where id = $1 and tenant_id = $2",
            patient_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    return PatientOut(**dict(row))


@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")

    set_clauses = []
    params: list = [patient_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")

    query = f"""
        update patients set {', '.join(set_clauses)}
        where id = $1 and tenant_id = $2
        returning id, name, email, phone, birth_date, status
    """

    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(query, *params)

    if row is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    return PatientOut(**dict(row))


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from patients where id = $1 and tenant_id = $2",
            patient_id,
            current.tenant_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Paciente não encontrado")


@router.get("/{patient_id}/tags", response_model=list[TagOut])
async def list_patient_tags(
    patient_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> list[TagOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        rows = await conn.fetch(
            """
            select t.id, t.name from tags t
            join patient_tags pt on pt.tag_id = t.id
            where pt.patient_id = $1
            order by t.name
            """,
            patient_id,
        )
    return [TagOut(**dict(row)) for row in rows]


@router.get("/{patient_id}/diary", response_model=list[DiaryEntryOut])
async def list_patient_diary(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[DiaryEntryOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        rows = await conn.fetch(
            """
            select id, logged_at::text, meal_kind, description from food_diary_entries
            where patient_id = $1 and tenant_id = $2
            order by logged_at desc limit $3 offset $4
            """,
            patient_id,
            current.tenant_id,
            limit,
            offset,
        )
    return [DiaryEntryOut(**dict(row)) for row in rows]
