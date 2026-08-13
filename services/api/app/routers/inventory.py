from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/inventory-items", tags=["inventory"])


class ItemCreate(BaseModel):
    name: str
    unit: str = "unidade"
    quantity: float = 0
    unit_price_cents: int = 0


class ItemUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    quantity: float | None = None
    unit_price_cents: int | None = None


class ItemOut(BaseModel):
    id: UUID
    name: str
    unit: str
    quantity: float
    unit_price_cents: int


class SellRequest(BaseModel):
    quantity: float
    patient_id: UUID | None = None


class SellResponse(BaseModel):
    item: ItemOut
    transaction_id: UUID


@router.get("", response_model=list[ItemOut])
async def list_items(
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ItemOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, name, unit, quantity, unit_price_cents from inventory_items "
            "where tenant_id = $1 order by name limit $2 offset $3",
            current.tenant_id,
            limit,
            offset,
        )
    return [ItemOut(**dict(row)) for row in rows]


@router.post("", response_model=ItemOut, status_code=201)
async def create_item(
    payload: ItemCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> ItemOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            insert into inventory_items (tenant_id, name, unit, quantity, unit_price_cents)
            values ($1, $2, $3, $4, $5)
            returning id, name, unit, quantity, unit_price_cents
            """,
            current.tenant_id,
            payload.name,
            payload.unit,
            payload.quantity,
            payload.unit_price_cents,
        )
    return ItemOut(**dict(row))


@router.patch("/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: UUID, payload: ItemUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> ItemOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [item_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"""
            update inventory_items set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning id, name, unit, quantity, unit_price_cents
            """,
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return ItemOut(**dict(row))


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from inventory_items where id = $1 and tenant_id = $2", item_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Produto não encontrado")


@router.post("/{item_id}/sell", response_model=SellResponse)
async def sell_item(
    item_id: UUID, payload: SellRequest, current: CurrentProfessional = Depends(get_current_professional)
) -> SellResponse:
    if payload.quantity <= 0:
        raise HTTPException(status_code=422, detail="Quantidade precisa ser maior que zero")
    async with db.tenant_connection(current.tenant_id) as conn:
        item = await conn.fetchrow(
            "select id, name, unit, quantity, unit_price_cents from inventory_items "
            "where id = $1 and tenant_id = $2",
            item_id,
            current.tenant_id,
        )
        if item is None:
            raise HTTPException(status_code=404, detail="Produto não encontrado")
        if item["quantity"] < payload.quantity:
            raise HTTPException(status_code=422, detail="Estoque insuficiente")

        if payload.patient_id:
            patient = await conn.fetchval(
                "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
            )
            if patient is None:
                raise HTTPException(status_code=422, detail="Paciente não encontrado")

        updated_item = await conn.fetchrow(
            "update inventory_items set quantity = quantity - $1 where id = $2 "
            "returning id, name, unit, quantity, unit_price_cents",
            payload.quantity,
            item_id,
        )
        total_cents = round(item["unit_price_cents"] * payload.quantity)
        transaction_id = await conn.fetchval(
            """
            insert into financial_transactions (tenant_id, patient_id, kind, amount_cents, paid_at, category)
            values ($1, $2, 'income', $3, now(), 'Venda de produtos')
            returning id
            """,
            current.tenant_id,
            payload.patient_id,
            total_cents,
        )
    return SellResponse(item=ItemOut(**dict(updated_item)), transaction_id=transaction_id)
