from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

Kind = Literal["supplement", "phytotherapic"]


class PrescriptionItem(BaseModel):
    description: str
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None


class PrescriptionCreate(BaseModel):
    patient_id: UUID
    kind: Kind
    items: list[PrescriptionItem]


class PrescriptionUpdate(BaseModel):
    kind: Kind | None = None
    items: list[PrescriptionItem] | None = None


class PrescriptionOut(BaseModel):
    id: UUID
    patient_id: UUID
    patient_name: str
    kind: str
    items: list[dict]


SELECT = """
    select pr.id, pr.patient_id, p.name as patient_name, pr.kind, pr.items
    from prescriptions pr join patients p on p.id = pr.patient_id
"""


@router.get("", response_model=list[PrescriptionOut])
async def list_prescriptions(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[PrescriptionOut]:
    conditions = ["pr.tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"pr.patient_id = ${len(params)}")
    params.extend([limit, offset])
    query = f"{SELECT} where {' and '.join(conditions)} order by pr.id desc limit ${len(params) - 1} offset ${len(params)}"
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [PrescriptionOut(**dict(row)) for row in rows]


@router.post("", response_model=PrescriptionOut, status_code=201)
async def create_prescription(
    payload: PrescriptionCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> PrescriptionOut:
    items = [i.model_dump() for i in payload.items]
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")
        prescription_id = await conn.fetchval(
            "insert into prescriptions (tenant_id, patient_id, kind, items) values ($1, $2, $3, $4) returning id",
            current.tenant_id,
            payload.patient_id,
            payload.kind,
            items,
        )
        row = await conn.fetchrow(f"{SELECT} where pr.id = $1", prescription_id)
    return PrescriptionOut(**dict(row))


@router.patch("/{prescription_id}", response_model=PrescriptionOut)
async def update_prescription(
    prescription_id: UUID,
    payload: PrescriptionUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PrescriptionOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    if "items" in fields:
        fields["items"] = [PrescriptionItem(**i).model_dump() for i in fields["items"]]
    set_clauses = []
    params: list = [prescription_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            f"update prescriptions set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 returning id",
            *params,
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Prescrição não encontrada")
        row = await conn.fetchrow(f"{SELECT} where pr.id = $1", updated_id)
    return PrescriptionOut(**dict(row))


@router.delete("/{prescription_id}", status_code=204)
async def delete_prescription(
    prescription_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from prescriptions where id = $1 and tenant_id = $2", prescription_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Prescrição não encontrada")
