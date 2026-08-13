from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/foods", tags=["foods"])


class FoodCreate(BaseModel):
    name: str
    kcal: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0


class FoodUpdate(BaseModel):
    name: str | None = None
    kcal: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None


class FoodOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    source: str
    name: str
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float


@router.get("", response_model=list[FoodOut])
async def list_foods(
    current: CurrentProfessional = Depends(get_current_professional),
    search: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[FoodOut]:
    conditions = ["(tenant_id is null or tenant_id = $1)"]
    params: list = [current.tenant_id]
    if search:
        params.append(f"%{search}%")
        conditions.append(f"name ilike ${len(params)}")

    params.extend([limit, offset])
    query = f"""
        select id, tenant_id, source, name, kcal, protein_g, carbs_g, fat_g
        from foods where {' and '.join(conditions)} order by name
        limit ${len(params) - 1} offset ${len(params)}
    """
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [FoodOut(**dict(row)) for row in rows]


@router.post("", response_model=FoodOut, status_code=201)
async def create_food(
    payload: FoodCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> FoodOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            insert into foods (tenant_id, source, name, kcal, protein_g, carbs_g, fat_g)
            values ($1, 'custom', $2, $3, $4, $5, $6)
            returning id, tenant_id, source, name, kcal, protein_g, carbs_g, fat_g
            """,
            current.tenant_id,
            payload.name,
            payload.kcal,
            payload.protein_g,
            payload.carbs_g,
            payload.fat_g,
        )
    return FoodOut(**dict(row))


@router.patch("/{food_id}", response_model=FoodOut)
async def update_food(
    food_id: UUID, payload: FoodUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> FoodOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [food_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"""
            update foods set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning id, tenant_id, source, name, kcal, protein_g, carbs_g, fat_g
            """,
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Alimento não encontrado (só é possível editar alimentos próprios)")
    return FoodOut(**dict(row))


@router.delete("/{food_id}", status_code=204)
async def delete_food(food_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute("delete from foods where id = $1 and tenant_id = $2", food_id, current.tenant_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Alimento não encontrado (só é possível excluir alimentos próprios)")
