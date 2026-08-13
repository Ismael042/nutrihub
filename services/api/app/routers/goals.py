from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/goals", tags=["goals"])


class GoalCreate(BaseModel):
    patient_id: UUID
    description: str
    target_date: date | None = None


class GoalUpdate(BaseModel):
    description: str | None = None
    target_date: date | None = None
    achieved: bool | None = None


class GoalOut(BaseModel):
    id: UUID
    patient_id: UUID
    patient_name: str
    description: str
    target_date: date | None
    achieved: bool


SELECT_GOAL = """
    select g.id, g.patient_id, p.name as patient_name, g.description, g.target_date, g.achieved
    from goals g join patients p on p.id = g.patient_id
"""


@router.get("", response_model=list[GoalOut])
async def list_goals(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[GoalOut]:
    conditions = ["g.tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"g.patient_id = ${len(params)}")
    params.extend([limit, offset])
    query = (
        f"{SELECT_GOAL} where {' and '.join(conditions)} order by g.target_date nulls last "
        f"limit ${len(params) - 1} offset ${len(params)}"
    )
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [GoalOut(**dict(row)) for row in rows]


@router.post("", response_model=GoalOut, status_code=201)
async def create_goal(
    payload: GoalCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> GoalOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")
        goal_id = await conn.fetchval(
            "insert into goals (tenant_id, patient_id, description, target_date) values ($1, $2, $3, $4) returning id",
            current.tenant_id,
            payload.patient_id,
            payload.description,
            payload.target_date,
        )
        row = await conn.fetchrow(f"{SELECT_GOAL} where g.id = $1", goal_id)
    return GoalOut(**dict(row))


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: UUID, payload: GoalUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> GoalOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [goal_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            f"update goals set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 returning id", *params
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Meta não encontrada")
        row = await conn.fetchrow(f"{SELECT_GOAL} where g.id = $1", updated_id)
    return GoalOut(**dict(row))


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(goal_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute("delete from goals where id = $1 and tenant_id = $2", goal_id, current.tenant_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Meta não encontrada")
