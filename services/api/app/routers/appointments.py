from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/appointments", tags=["appointments"])

AppointmentStatus = Literal["scheduled", "completed", "canceled", "no_show"]


class AppointmentCreate(BaseModel):
    patient_id: UUID
    location_id: UUID | None = None
    scheduled_at: datetime


class AppointmentUpdate(BaseModel):
    location_id: UUID | None = None
    scheduled_at: datetime | None = None
    status: AppointmentStatus | None = None


class AppointmentOut(BaseModel):
    id: UUID
    patient_id: UUID
    patient_name: str
    location_id: UUID | None
    location_name: str | None
    scheduled_at: datetime
    status: str


SELECT_APPOINTMENT = """
    select
        a.id, a.patient_id, p.name as patient_name,
        a.location_id, l.name as location_name,
        a.scheduled_at, a.status
    from appointments a
    join patients p on p.id = a.patient_id
    left join locations l on l.id = a.location_id
"""


@router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    status_filter: AppointmentStatus | None = Query(None, alias="status"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[AppointmentOut]:
    conditions = ["a.tenant_id = $1"]
    params: list = [current.tenant_id]

    if patient_id:
        params.append(patient_id)
        conditions.append(f"a.patient_id = ${len(params)}")

    if status_filter:
        params.append(status_filter)
        conditions.append(f"a.status = ${len(params)}")

    params.extend([limit, offset])
    query = (
        f"{SELECT_APPOINTMENT} where {' and '.join(conditions)} order by a.scheduled_at "
        f"limit ${len(params) - 1} offset ${len(params)}"
    )

    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)

    return [AppointmentOut(**dict(row)) for row in rows]


@router.post("", response_model=AppointmentOut, status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> AppointmentOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")

        appointment_id = await conn.fetchval(
            """
            insert into appointments (tenant_id, patient_id, location_id, scheduled_at)
            values ($1, $2, $3, $4)
            returning id
            """,
            current.tenant_id,
            payload.patient_id,
            payload.location_id,
            payload.scheduled_at,
        )
        row = await conn.fetchrow(f"{SELECT_APPOINTMENT} where a.id = $1", appointment_id)

    return AppointmentOut(**dict(row))


@router.patch("/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: UUID,
    payload: AppointmentUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> AppointmentOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")

    set_clauses = []
    params: list = [appointment_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")

    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            f"""
            update appointments set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning id
            """,
            *params,
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        row = await conn.fetchrow(f"{SELECT_APPOINTMENT} where a.id = $1", updated_id)

    return AppointmentOut(**dict(row))


@router.delete("/{appointment_id}", status_code=204)
async def delete_appointment(
    appointment_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from appointments where id = $1 and tenant_id = $2", appointment_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
