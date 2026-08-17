from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core import db, storage
from app.core.deps import CurrentPatient, get_current_patient
from app.core.plan_pdf import render_plan_pdf

router = APIRouter(prefix="/patient-portal", tags=["patient-portal"])


class MeOut(BaseModel):
    id: UUID
    name: str
    email: str | None


class MealItemOut(BaseModel):
    id: UUID
    food_id: UUID
    food_name: str
    quantity: float
    unit: str


class MealOut(BaseModel):
    id: UUID
    name: str
    sort_order: int
    items: list[MealItemOut]


class DietPlanOut(BaseModel):
    id: UUID
    name: str
    created_at: str


class DietPlanDetailOut(DietPlanOut):
    meals: list[MealOut]


class PrescriptionItemOut(BaseModel):
    description: str
    dosage: str | None
    frequency: str | None
    duration: str | None


class PrescriptionOut(BaseModel):
    id: UUID
    kind: str
    items: list[dict]


class GoalOut(BaseModel):
    id: UUID
    description: str
    target_date: str | None
    achieved: bool


class DiaryEntryCreate(BaseModel):
    logged_at: datetime | None = None
    meal_kind: str | None = None
    description: str


class DiaryEntryOut(BaseModel):
    id: UUID
    logged_at: datetime
    meal_kind: str | None
    description: str


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: UUID
    sender: str
    content: str
    created_at: datetime


@router.get("/me", response_model=MeOut)
async def me(current: CurrentPatient = Depends(get_current_patient)) -> MeOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "select id, name, email from patients where id = $1 and tenant_id = $2",
            current.patient_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    return MeOut(**dict(row))


@router.get("/diet-plans", response_model=list[DietPlanOut])
async def list_my_diet_plans(current: CurrentPatient = Depends(get_current_patient)) -> list[DietPlanOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, name, created_at::text from diet_plans "
            "where patient_id = $1 and tenant_id = $2 order by created_at desc",
            current.patient_id,
            current.tenant_id,
        )
    return [DietPlanOut(**dict(row)) for row in rows]


async def _load_plan_detail(conn, plan_id: UUID, patient_id: UUID, tenant_id: UUID) -> DietPlanDetailOut | None:
    plan_row = await conn.fetchrow(
        "select id, name, created_at::text from diet_plans where id = $1 and patient_id = $2 and tenant_id = $3",
        plan_id,
        patient_id,
        tenant_id,
    )
    if plan_row is None:
        return None

    meal_rows = await conn.fetch(
        "select id, name, sort_order from meals where diet_plan_id = $1 order by sort_order", plan_id
    )
    meals = []
    for meal_row in meal_rows:
        item_rows = await conn.fetch(
            """
            select mi.id, mi.food_id, f.name as food_name, mi.quantity, mi.unit
            from meal_items mi join foods f on f.id = mi.food_id
            where mi.meal_id = $1
            """,
            meal_row["id"],
        )
        meals.append(
            MealOut(
                id=meal_row["id"],
                name=meal_row["name"],
                sort_order=meal_row["sort_order"],
                items=[MealItemOut(**dict(r)) for r in item_rows],
            )
        )
    return DietPlanDetailOut(**dict(plan_row), meals=meals)


@router.get("/diet-plans/{plan_id}", response_model=DietPlanDetailOut)
async def get_my_diet_plan(
    plan_id: UUID, current: CurrentPatient = Depends(get_current_patient)
) -> DietPlanDetailOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        detail = await _load_plan_detail(conn, plan_id, current.patient_id, current.tenant_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")
    return detail


@router.get("/diet-plans/{plan_id}/pdf")
async def get_my_diet_plan_pdf(plan_id: UUID, current: CurrentPatient = Depends(get_current_patient)):
    async with db.tenant_connection(current.tenant_id) as conn:
        detail = await _load_plan_detail(conn, plan_id, current.patient_id, current.tenant_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")

    # show_patient=False: o paciente já sabe que o plano é dele; a linha "Paciente:"
    # existe só na versão que o profissional baixa. Mantém o layout que já existia aqui.
    async with db.tenant_connection(current.tenant_id) as conn:
        logo_key = await conn.fetchval("select logo_key from tenants where id = $1", current.tenant_id)
    logo_bytes = await storage.get_private_bytes(logo_key)
    buffer = render_plan_pdf(detail, logo_bytes=logo_bytes, show_patient=False)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="plano-{plan_id}.pdf"'},
    )


@router.get("/prescriptions", response_model=list[PrescriptionOut])
async def list_my_prescriptions(current: CurrentPatient = Depends(get_current_patient)) -> list[PrescriptionOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, kind, items from prescriptions where patient_id = $1 and tenant_id = $2 order by id desc",
            current.patient_id,
            current.tenant_id,
        )
    return [PrescriptionOut(**dict(row)) for row in rows]


@router.get("/goals", response_model=list[GoalOut])
async def list_my_goals(current: CurrentPatient = Depends(get_current_patient)) -> list[GoalOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, description, target_date::text, achieved from goals "
            "where patient_id = $1 and tenant_id = $2 order by target_date nulls last",
            current.patient_id,
            current.tenant_id,
        )
    return [GoalOut(**dict(row)) for row in rows]


@router.get("/diary", response_model=list[DiaryEntryOut])
async def list_my_diary(
    current: CurrentPatient = Depends(get_current_patient),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[DiaryEntryOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            """
            select id, logged_at, meal_kind, description from food_diary_entries
            where patient_id = $1 and tenant_id = $2
            order by logged_at desc limit $3 offset $4
            """,
            current.patient_id,
            current.tenant_id,
            limit,
            offset,
        )
    return [DiaryEntryOut(**dict(row)) for row in rows]


@router.post("/diary", response_model=DiaryEntryOut, status_code=201)
async def create_my_diary_entry(
    payload: DiaryEntryCreate, current: CurrentPatient = Depends(get_current_patient)
) -> DiaryEntryOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            insert into food_diary_entries (tenant_id, patient_id, logged_at, meal_kind, description)
            values ($1, $2, coalesce($3, now()), $4, $5)
            returning id, logged_at, meal_kind, description
            """,
            current.tenant_id,
            current.patient_id,
            payload.logged_at,
            payload.meal_kind,
            payload.description,
        )
    return DiaryEntryOut(**dict(row))


@router.delete("/diary/{entry_id}", status_code=204)
async def delete_my_diary_entry(entry_id: UUID, current: CurrentPatient = Depends(get_current_patient)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from food_diary_entries where id = $1 and patient_id = $2 and tenant_id = $3",
            entry_id,
            current.patient_id,
            current.tenant_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Registro não encontrado")


@router.get("/chat", response_model=list[MessageOut])
async def list_my_chat(
    current: CurrentPatient = Depends(get_current_patient),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[MessageOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            """
            select id, sender, content, created_at from chat_messages
            where patient_id = $1 and tenant_id = $2
            order by created_at limit $3 offset $4
            """,
            current.patient_id,
            current.tenant_id,
            limit,
            offset,
        )
    return [MessageOut(**dict(row)) for row in rows]


@router.post("/chat", response_model=MessageOut, status_code=201)
async def send_my_message(
    payload: MessageCreate, current: CurrentPatient = Depends(get_current_patient)
) -> MessageOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            insert into chat_messages (tenant_id, patient_id, sender, content)
            values ($1, $2, 'patient', $3)
            returning id, sender, content, created_at
            """,
            current.tenant_id,
            current.patient_id,
            payload.content,
        )
    return MessageOut(**dict(row))
