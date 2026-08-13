from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/recipes", tags=["recipes"])


class RecipeCreate(BaseModel):
    name: str
    instructions: str | None = None


class RecipeUpdate(BaseModel):
    name: str | None = None
    instructions: str | None = None


class RecipeOut(BaseModel):
    id: UUID
    name: str
    instructions: str | None


@router.get("", response_model=list[RecipeOut])
async def list_recipes(
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[RecipeOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, name, instructions from recipes where tenant_id = $1 order by name limit $2 offset $3",
            current.tenant_id,
            limit,
            offset,
        )
    return [RecipeOut(**dict(row)) for row in rows]


@router.post("", response_model=RecipeOut, status_code=201)
async def create_recipe(
    payload: RecipeCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> RecipeOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "insert into recipes (tenant_id, name, instructions) values ($1, $2, $3) "
            "returning id, name, instructions",
            current.tenant_id,
            payload.name,
            payload.instructions,
        )
    return RecipeOut(**dict(row))


@router.patch("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: UUID, payload: RecipeUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> RecipeOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [recipe_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"update recipes set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 "
            "returning id, name, instructions",
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    return RecipeOut(**dict(row))


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from recipes where id = $1 and tenant_id = $2", recipe_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Receita não encontrada")
