from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/substitution-lists", tags=["substitution-lists"])


class SubstitutionItem(BaseModel):
    name: str
    portion: str


class SubstitutionListCreate(BaseModel):
    category: str
    name: str
    items: list[SubstitutionItem]


class SubstitutionListUpdate(BaseModel):
    category: str | None = None
    name: str | None = None
    items: list[SubstitutionItem] | None = None


class SubstitutionListOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    category: str
    name: str
    items: list[dict]


@router.get("", response_model=list[SubstitutionListOut])
async def list_substitution_lists(
    current: CurrentProfessional = Depends(get_current_professional),
) -> list[SubstitutionListOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, tenant_id, category, name, items from substitution_lists "
            "where tenant_id is null or tenant_id = $1 order by category, name",
            current.tenant_id,
        )
    return [SubstitutionListOut(**dict(row)) for row in rows]


@router.post("", response_model=SubstitutionListOut, status_code=201)
async def create_substitution_list(
    payload: SubstitutionListCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> SubstitutionListOut:
    items = [i.model_dump() for i in payload.items]
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "insert into substitution_lists (tenant_id, category, name, items) values ($1, $2, $3, $4) "
            "returning id, tenant_id, category, name, items",
            current.tenant_id,
            payload.category,
            payload.name,
            items,
        )
    return SubstitutionListOut(**dict(row))


@router.patch("/{list_id}", response_model=SubstitutionListOut)
async def update_substitution_list(
    list_id: UUID,
    payload: SubstitutionListUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> SubstitutionListOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    if "items" in fields:
        fields["items"] = [SubstitutionItem(**i).model_dump() for i in fields["items"]]
    set_clauses = []
    # tenant_id = $2 (não `is null or`) de propósito: só listas próprias podem ser
    # editadas — os 4 modelos padrão (tenant_id null) são somente leitura pra todo tenant.
    params: list = [list_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"""
            update substitution_lists set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning id, tenant_id, category, name, items
            """,
            *params,
        )
    if row is None:
        raise HTTPException(
            status_code=404, detail="Lista não encontrada (modelos padrão do sistema não podem ser editados)"
        )
    return SubstitutionListOut(**dict(row))


@router.delete("/{list_id}", status_code=204)
async def delete_substitution_list(
    list_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from substitution_lists where id = $1 and tenant_id = $2", list_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(
            status_code=404, detail="Lista não encontrada (modelos padrão do sistema não podem ser excluídos)"
        )
