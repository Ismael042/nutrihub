from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])

Kind = Literal["anamnesis", "pre_consultation"]


class TemplateField(BaseModel):
    label: str
    type: str = "text"


class TemplateCreate(BaseModel):
    kind: Kind
    name: str
    fields: list[TemplateField]


class TemplateUpdate(BaseModel):
    name: str | None = None
    fields: list[TemplateField] | None = None


class ResponseUpdate(BaseModel):
    answers: dict


class TemplateOut(BaseModel):
    id: UUID
    kind: str
    name: str
    fields: list[dict]


class ResponseCreate(BaseModel):
    template_id: UUID
    patient_id: UUID
    answers: dict


class ResponseOut(BaseModel):
    id: UUID
    template_id: UUID
    patient_id: UUID
    patient_name: str
    answers: dict
    created_at: str


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[TemplateOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, kind, name, fields from questionnaire_templates where tenant_id = $1 "
            "order by name limit $2 offset $3",
            current.tenant_id,
            limit,
            offset,
        )
    return [TemplateOut(id=r["id"], kind=r["kind"], name=r["name"], fields=r["fields"]) for r in rows]


@router.post("/templates", response_model=TemplateOut, status_code=201)
async def create_template(
    payload: TemplateCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> TemplateOut:
    fields = [f.model_dump() for f in payload.fields]
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "insert into questionnaire_templates (tenant_id, kind, name, fields) values ($1, $2, $3, $4) "
            "returning id, kind, name, fields",
            current.tenant_id,
            payload.kind,
            payload.name,
            fields,
        )
    return TemplateOut(id=row["id"], kind=row["kind"], name=row["name"], fields=row["fields"])


@router.patch("/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: UUID, payload: TemplateUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> TemplateOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    if "fields" in fields:
        fields["fields"] = [TemplateField(**f).model_dump() for f in fields["fields"]]
    set_clauses = []
    params: list = [template_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"""
            update questionnaire_templates set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning id, kind, name, fields
            """,
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Modelo não encontrado")
    return TemplateOut(id=row["id"], kind=row["kind"], name=row["name"], fields=row["fields"])


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from questionnaire_templates where id = $1 and tenant_id = $2", template_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Modelo não encontrado")


@router.get("/responses", response_model=list[ResponseOut])
async def list_responses(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ResponseOut]:
    conditions = ["r.tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"r.patient_id = ${len(params)}")
    params.extend([limit, offset])
    query = f"""
        select r.id, r.template_id, r.patient_id, p.name as patient_name, r.answers, r.created_at::text
        from questionnaire_responses r join patients p on p.id = r.patient_id
        where {' and '.join(conditions)} order by r.created_at desc
        limit ${len(params) - 1} offset ${len(params)}
    """
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [ResponseOut(**dict(row)) for row in rows]


@router.post("/responses", response_model=ResponseOut, status_code=201)
async def create_response(
    payload: ResponseCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> ResponseOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        template = await conn.fetchval(
            "select id from questionnaire_templates where id = $1 and tenant_id = $2",
            payload.template_id,
            current.tenant_id,
        )
        if patient is None or template is None:
            raise HTTPException(status_code=422, detail="Paciente ou modelo não encontrado")

        response_id = await conn.fetchval(
            "insert into questionnaire_responses (tenant_id, template_id, patient_id, answers) "
            "values ($1, $2, $3, $4) returning id",
            current.tenant_id,
            payload.template_id,
            payload.patient_id,
            payload.answers,
        )
        row = await conn.fetchrow(
            """
            select r.id, r.template_id, r.patient_id, p.name as patient_name, r.answers, r.created_at::text
            from questionnaire_responses r join patients p on p.id = r.patient_id
            where r.id = $1
            """,
            response_id,
        )
    return ResponseOut(**dict(row))


@router.patch("/responses/{response_id}", response_model=ResponseOut)
async def update_response(
    response_id: UUID, payload: ResponseUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> ResponseOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            "update questionnaire_responses set answers = $1 where id = $2 and tenant_id = $3 returning id",
            payload.answers,
            response_id,
            current.tenant_id,
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Resposta não encontrada")
        row = await conn.fetchrow(
            """
            select r.id, r.template_id, r.patient_id, p.name as patient_name, r.answers, r.created_at::text
            from questionnaire_responses r join patients p on p.id = r.patient_id
            where r.id = $1
            """,
            updated_id,
        )
    return ResponseOut(**dict(row))


@router.delete("/responses/{response_id}", status_code=204)
async def delete_response(
    response_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from questionnaire_responses where id = $1 and tenant_id = $2", response_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Resposta não encontrada")
