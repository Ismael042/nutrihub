from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.core import db, storage
from app.core.deps import CurrentProfessional, get_current_professional
from app.core.photos import read_upload, replace_photo

router = APIRouter(prefix="/recipes", tags=["recipes"])

COLUMNS = "id, name, instructions, photo_key"


def _out(row) -> "RecipeOut":
    data = dict(row)
    # Bucket privado: o banco guarda a chave, a URL é assinada na leitura e expira.
    data["photo_url"] = storage.presigned_get_url(data.pop("photo_key", None))
    return RecipeOut(**data)


class RecipeCreate(BaseModel):
    name: str
    instructions: str | None = None


class RecipeUpdate(BaseModel):
    name: str | None = None
    instructions: str | None = None
    # photo_key NÃO entra aqui de propósito: o SET do PATCH é montado dinamicamente a
    # partir das chaves deste modelo, então incluí-la deixaria qualquer cliente
    # autenticado apontar a foto pra objeto arbitrário. Foto só muda por
    # POST/DELETE /recipes/{id}/photo.


class RecipeOut(BaseModel):
    id: UUID
    name: str
    instructions: str | None
    photo_url: str | None = None


@router.get("", response_model=list[RecipeOut])
async def list_recipes(
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[RecipeOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            f"select {COLUMNS} from recipes where tenant_id = $1 order by name limit $2 offset $3",
            current.tenant_id,
            limit,
            offset,
        )
    return [_out(row) for row in rows]


@router.post("", response_model=RecipeOut, status_code=201)
async def create_recipe(
    payload: RecipeCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> RecipeOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"insert into recipes (tenant_id, name, instructions) values ($1, $2, $3) returning {COLUMNS}",
            current.tenant_id,
            payload.name,
            payload.instructions,
        )
    return _out(row)


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
            f"update recipes set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 returning {COLUMNS}",
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    return _out(row)


@router.post("/{recipe_id}/photo", response_model=RecipeOut)
async def upload_recipe_photo(
    recipe_id: UUID,
    file: UploadFile = File(...),
    current: CurrentProfessional = Depends(get_current_professional),
) -> RecipeOut:
    raw = await read_upload(file)

    async def swap_key(new_key: str):
        async with db.tenant_connection(current.tenant_id) as conn:
            old_key = await conn.fetchval(
                "select photo_key from recipes where id = $1 and tenant_id = $2",
                recipe_id,
                current.tenant_id,
            )
            row = await conn.fetchrow(
                f"""
                update recipes set photo_key = $3 where id = $1 and tenant_id = $2
                returning {COLUMNS}
                """,
                recipe_id,
                current.tenant_id,
                new_key,
            )
        if row is None:
            raise HTTPException(status_code=404, detail="Receita não encontrada")
        return row, old_key

    row = await replace_photo(raw, prefix="recipes", owner_id=recipe_id, swap_key=swap_key)
    return _out(row)


@router.delete("/{recipe_id}/photo", response_model=RecipeOut)
async def delete_recipe_photo(
    recipe_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> RecipeOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        old_key = await conn.fetchval(
            "select photo_key from recipes where id = $1 and tenant_id = $2",
            recipe_id,
            current.tenant_id,
        )
        row = await conn.fetchrow(
            f"""
            update recipes set photo_key = null where id = $1 and tenant_id = $2
            returning {COLUMNS}
            """,
            recipe_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Receita não encontrada")

    await storage.delete_private(old_key)
    return _out(row)


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from recipes where id = $1 and tenant_id = $2", recipe_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Receita não encontrada")
