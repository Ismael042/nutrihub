from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core import db, storage
from app.core.deps import CurrentProfessional, get_current_professional
from app.core.plan_pdf import render_plan_pdf

router = APIRouter(prefix="/diet-plans", tags=["diet-plans"])


async def _load_logo_bytes(tenant_id) -> bytes | None:
    """Logo do consultório pro cabeçalho do PDF. None em qualquer falha — o PDF sai
    sem logo em vez de quebrar."""
    async with db.tenant_connection(tenant_id) as conn:
        logo_key = await conn.fetchval("select logo_key from tenants where id = $1", tenant_id)
    return await storage.get_private_bytes(logo_key)


class DietPlanCreate(BaseModel):
    patient_id: UUID
    name: str


class DietPlanOut(BaseModel):
    id: UUID
    patient_id: UUID
    patient_name: str
    name: str
    created_at: str


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


class DietPlanDetailOut(DietPlanOut):
    meals: list[MealOut]


class MealCreate(BaseModel):
    name: str
    sort_order: int = 0


class MealItemCreate(BaseModel):
    food_id: UUID
    quantity: float
    unit: str = "g"


@router.get("", response_model=list[DietPlanOut])
async def list_diet_plans(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[DietPlanOut]:
    conditions = ["dp.tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"dp.patient_id = ${len(params)}")

    params.extend([limit, offset])
    query = f"""
        select dp.id, dp.patient_id, p.name as patient_name, dp.name, dp.created_at::text
        from diet_plans dp
        join patients p on p.id = dp.patient_id
        where {' and '.join(conditions)}
        order by dp.created_at desc
        limit ${len(params) - 1} offset ${len(params)}
    """
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [DietPlanOut(**dict(row)) for row in rows]


@router.post("", response_model=DietPlanOut, status_code=201)
async def create_diet_plan(
    payload: DietPlanCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> DietPlanOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")

        plan_id = await conn.fetchval(
            "insert into diet_plans (tenant_id, patient_id, name) values ($1, $2, $3) returning id",
            current.tenant_id,
            payload.patient_id,
            payload.name,
        )
        row = await conn.fetchrow(
            """
            select dp.id, dp.patient_id, p.name as patient_name, dp.name, dp.created_at::text
            from diet_plans dp join patients p on p.id = dp.patient_id
            where dp.id = $1
            """,
            plan_id,
        )
    return DietPlanOut(**dict(row))


async def _load_plan_detail(conn, plan_id: UUID, tenant_id: UUID) -> DietPlanDetailOut | None:
    plan_row = await conn.fetchrow(
        """
        select dp.id, dp.patient_id, p.name as patient_name, dp.name, dp.created_at::text
        from diet_plans dp join patients p on p.id = dp.patient_id
        where dp.id = $1 and dp.tenant_id = $2
        """,
        plan_id,
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


@router.get("/{plan_id}", response_model=DietPlanDetailOut)
async def get_diet_plan(
    plan_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> DietPlanDetailOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        detail = await _load_plan_detail(conn, plan_id, current.tenant_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")
    return detail


@router.delete("/{plan_id}", status_code=204)
async def delete_diet_plan(
    plan_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from diet_plans where id = $1 and tenant_id = $2", plan_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")


@router.post("/{plan_id}/meals", response_model=MealOut, status_code=201)
async def add_meal(
    plan_id: UUID, payload: MealCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> MealOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        plan = await conn.fetchval(
            "select id from diet_plans where id = $1 and tenant_id = $2", plan_id, current.tenant_id
        )
        if plan is None:
            raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")

        meal_id = await conn.fetchval(
            "insert into meals (diet_plan_id, name, sort_order) values ($1, $2, $3) returning id",
            plan_id,
            payload.name,
            payload.sort_order,
        )
    return MealOut(id=meal_id, name=payload.name, sort_order=payload.sort_order, items=[])


@router.delete("/{plan_id}/meals/{meal_id}", status_code=204)
async def delete_meal(
    plan_id: UUID, meal_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            """
            delete from meals where id = $1 and diet_plan_id in (
                select id from diet_plans where id = $2 and tenant_id = $3
            )
            """,
            meal_id,
            plan_id,
            current.tenant_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Refeição não encontrada")


@router.post("/{plan_id}/meals/{meal_id}/items", response_model=MealItemOut, status_code=201)
async def add_meal_item(
    plan_id: UUID,
    meal_id: UUID,
    payload: MealItemCreate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> MealItemOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        meal = await conn.fetchval(
            """
            select m.id from meals m join diet_plans dp on dp.id = m.diet_plan_id
            where m.id = $1 and dp.id = $2 and dp.tenant_id = $3
            """,
            meal_id,
            plan_id,
            current.tenant_id,
        )
        if meal is None:
            raise HTTPException(status_code=404, detail="Refeição não encontrada")

        food = await conn.fetchrow(
            "select id, name from foods where id = $1 and (tenant_id is null or tenant_id = $2)",
            payload.food_id,
            current.tenant_id,
        )
        if food is None:
            raise HTTPException(status_code=422, detail="Alimento não encontrado")

        item_id = await conn.fetchval(
            "insert into meal_items (meal_id, food_id, quantity, unit) values ($1, $2, $3, $4) returning id",
            meal_id,
            payload.food_id,
            payload.quantity,
            payload.unit,
        )
    return MealItemOut(
        id=item_id, food_id=payload.food_id, food_name=food["name"], quantity=payload.quantity, unit=payload.unit
    )


@router.delete("/{plan_id}/meals/{meal_id}/items/{item_id}", status_code=204)
async def delete_meal_item(
    plan_id: UUID,
    meal_id: UUID,
    item_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            """
            delete from meal_items where id = $1 and meal_id in (
                select m.id from meals m join diet_plans dp on dp.id = m.diet_plan_id
                where m.id = $2 and dp.id = $3 and dp.tenant_id = $4
            )
            """,
            item_id,
            meal_id,
            plan_id,
            current.tenant_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Item não encontrado")


@router.get("/{plan_id}/pdf")
async def generate_pdf(plan_id: UUID, current: CurrentProfessional = Depends(get_current_professional)):
    async with db.tenant_connection(current.tenant_id) as conn:
        detail = await _load_plan_detail(conn, plan_id, current.tenant_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")

    logo_bytes = await _load_logo_bytes(current.tenant_id)
    buffer = render_plan_pdf(detail, logo_bytes=logo_bytes)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="plano-{plan_id}.pdf"'},
    )
