from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/lab-exam-requests", tags=["lab-exams"])


class ExamItem(BaseModel):
    name: str


class LabExamCreate(BaseModel):
    patient_id: UUID
    exams: list[ExamItem]
    notes: str | None = None


class LabExamUpdate(BaseModel):
    exams: list[ExamItem] | None = None
    notes: str | None = None


class LabExamOut(BaseModel):
    id: UUID
    patient_id: UUID
    patient_name: str
    exams: list[dict]
    notes: str | None
    requested_at: date


SELECT = """
    select l.id, l.patient_id, p.name as patient_name, l.exams, l.notes, l.requested_at
    from lab_exam_requests l join patients p on p.id = l.patient_id
"""


@router.get("", response_model=list[LabExamOut])
async def list_lab_exams(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[LabExamOut]:
    conditions = ["l.tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"l.patient_id = ${len(params)}")
    params.extend([limit, offset])
    query = (
        f"{SELECT} where {' and '.join(conditions)} order by l.requested_at desc "
        f"limit ${len(params) - 1} offset ${len(params)}"
    )
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [LabExamOut(**dict(row)) for row in rows]


@router.post("", response_model=LabExamOut, status_code=201)
async def create_lab_exam(
    payload: LabExamCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> LabExamOut:
    exams = [e.model_dump() for e in payload.exams]
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")
        exam_id = await conn.fetchval(
            "insert into lab_exam_requests (tenant_id, patient_id, exams, notes) values ($1, $2, $3, $4) returning id",
            current.tenant_id,
            payload.patient_id,
            exams,
            payload.notes,
        )
        row = await conn.fetchrow(f"{SELECT} where l.id = $1", exam_id)
    return LabExamOut(**dict(row))


@router.patch("/{exam_id}", response_model=LabExamOut)
async def update_lab_exam(
    exam_id: UUID, payload: LabExamUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> LabExamOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    if "exams" in fields:
        fields["exams"] = [ExamItem(**e).model_dump() for e in fields["exams"]]
    set_clauses = []
    params: list = [exam_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            f"update lab_exam_requests set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 returning id",
            *params,
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Solicitação não encontrada")
        row = await conn.fetchrow(f"{SELECT} where l.id = $1", updated_id)
    return LabExamOut(**dict(row))


@router.delete("/{exam_id}", status_code=204)
async def delete_lab_exam(exam_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from lab_exam_requests where id = $1 and tenant_id = $2", exam_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
