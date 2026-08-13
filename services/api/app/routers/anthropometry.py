from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/anthropometric-measurements", tags=["anthropometry"])


class MeasurementCreate(BaseModel):
    patient_id: UUID
    measured_at: date | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    body_fat_pct: float | None = None
    waist_cm: float | None = None
    hip_cm: float | None = None
    neck_cm: float | None = None
    notes: str | None = None


class MeasurementUpdate(BaseModel):
    measured_at: date | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    body_fat_pct: float | None = None
    waist_cm: float | None = None
    hip_cm: float | None = None
    neck_cm: float | None = None
    notes: str | None = None


class MeasurementOut(BaseModel):
    id: UUID
    patient_id: UUID
    measured_at: date
    weight_kg: float | None
    height_cm: float | None
    body_fat_pct: float | None
    waist_cm: float | None
    hip_cm: float | None
    neck_cm: float | None
    notes: str | None


COLUMNS = "id, patient_id, measured_at, weight_kg, height_cm, body_fat_pct, waist_cm, hip_cm, neck_cm, notes"


@router.get("", response_model=list[MeasurementOut])
async def list_measurements(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[MeasurementOut]:
    conditions = ["tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"patient_id = ${len(params)}")
    params.extend([limit, offset])
    query = (
        f"select {COLUMNS} from anthropometric_measurements where {' and '.join(conditions)} "
        f"order by measured_at limit ${len(params) - 1} offset ${len(params)}"
    )
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [MeasurementOut(**dict(row)) for row in rows]


@router.post("", response_model=MeasurementOut, status_code=201)
async def create_measurement(
    payload: MeasurementCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> MeasurementOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")
        row = await conn.fetchrow(
            f"""
            insert into anthropometric_measurements
                (tenant_id, patient_id, measured_at, weight_kg, height_cm, body_fat_pct, waist_cm, hip_cm, neck_cm, notes)
            values ($1, $2, coalesce($3, current_date), $4, $5, $6, $7, $8, $9, $10)
            returning {COLUMNS}
            """,
            current.tenant_id,
            payload.patient_id,
            payload.measured_at,
            payload.weight_kg,
            payload.height_cm,
            payload.body_fat_pct,
            payload.waist_cm,
            payload.hip_cm,
            payload.neck_cm,
            payload.notes,
        )
    return MeasurementOut(**dict(row))


@router.patch("/{measurement_id}", response_model=MeasurementOut)
async def update_measurement(
    measurement_id: UUID,
    payload: MeasurementUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> MeasurementOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [measurement_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"""
            update anthropometric_measurements set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning {COLUMNS}
            """,
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Medição não encontrada")
    return MeasurementOut(**dict(row))


@router.delete("/{measurement_id}", status_code=204)
async def delete_measurement(
    measurement_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from anthropometric_measurements where id = $1 and tenant_id = $2",
            measurement_id,
            current.tenant_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Medição não encontrada")
