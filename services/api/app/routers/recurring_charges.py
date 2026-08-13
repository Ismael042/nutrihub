from datetime import date, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/recurring-charges", tags=["recurring-charges"])

Kind = Literal["income", "expense"]
Frequency = Literal["weekly", "monthly"]


class RecurringChargeCreate(BaseModel):
    patient_id: UUID | None = None
    kind: Kind = "income"
    description: str
    amount_cents: int
    category: str | None = None
    frequency: Frequency
    next_due_date: date


class RecurringChargeUpdate(BaseModel):
    description: str | None = None
    amount_cents: int | None = None
    category: str | None = None
    frequency: Frequency | None = None
    next_due_date: date | None = None
    active: bool | None = None


class RecurringChargeOut(BaseModel):
    id: UUID
    patient_id: UUID | None
    patient_name: str | None
    kind: str
    description: str
    amount_cents: int
    category: str | None
    frequency: str
    next_due_date: date
    active: bool


SELECT = """
    select r.id, r.patient_id, p.name as patient_name, r.kind, r.description,
           r.amount_cents, r.category, r.frequency, r.next_due_date, r.active
    from recurring_charges r left join patients p on p.id = r.patient_id
"""


def _advance(current_due: date, frequency: str) -> date:
    if frequency == "weekly":
        return current_due + timedelta(weeks=1)
    # "monthly": soma ~1 mês sem depender de libs externas (dateutil não é dependência
    # do projeto) — cai pro último dia do mês seguinte quando o dia não existe (ex:
    # 31/01 -> 28 ou 29/02), igual a maioria das rotinas de cobrança recorrente faz.
    month = current_due.month + 1
    year = current_due.year + (1 if month > 12 else 0)
    month = 1 if month > 12 else month
    day = current_due.day
    while True:
        try:
            return date(year, month, day)
        except ValueError:
            day -= 1


@router.get("", response_model=list[RecurringChargeOut])
async def list_recurring_charges(
    current: CurrentProfessional = Depends(get_current_professional),
    active_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[RecurringChargeOut]:
    conditions = ["r.tenant_id = $1"]
    params: list = [current.tenant_id]
    if active_only:
        conditions.append("r.active = true")
    params.extend([limit, offset])
    query = (
        f"{SELECT} where {' and '.join(conditions)} order by r.next_due_date "
        f"limit ${len(params) - 1} offset ${len(params)}"
    )
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [RecurringChargeOut(**dict(row)) for row in rows]


@router.post("", response_model=RecurringChargeOut, status_code=201)
async def create_recurring_charge(
    payload: RecurringChargeCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> RecurringChargeOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        if payload.patient_id:
            patient = await conn.fetchval(
                "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
            )
            if patient is None:
                raise HTTPException(status_code=422, detail="Paciente não encontrado")
        charge_id = await conn.fetchval(
            """
            insert into recurring_charges
                (tenant_id, patient_id, kind, description, amount_cents, category, frequency, next_due_date)
            values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning id
            """,
            current.tenant_id,
            payload.patient_id,
            payload.kind,
            payload.description,
            payload.amount_cents,
            payload.category,
            payload.frequency,
            payload.next_due_date,
        )
        row = await conn.fetchrow(f"{SELECT} where r.id = $1", charge_id)
    return RecurringChargeOut(**dict(row))


@router.patch("/{charge_id}", response_model=RecurringChargeOut)
async def update_recurring_charge(
    charge_id: UUID,
    payload: RecurringChargeUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> RecurringChargeOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [charge_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            f"update recurring_charges set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 returning id",
            *params,
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Cobrança recorrente não encontrada")
        row = await conn.fetchrow(f"{SELECT} where r.id = $1", updated_id)
    return RecurringChargeOut(**dict(row))


@router.delete("/{charge_id}", status_code=204)
async def delete_recurring_charge(
    charge_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from recurring_charges where id = $1 and tenant_id = $2", charge_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Cobrança recorrente não encontrada")


@router.post("/{charge_id}/generate", status_code=201)
async def generate_transaction(
    charge_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> dict:
    """Cria um financial_transactions pendente pra próxima data e avança a recorrência.

    Disparado manualmente (botão na UI) — não existe worker/cron nesta fase, ver
    comentário da migration 0010_recurring_charges.sql.
    """
    async with db.tenant_connection(current.tenant_id) as conn:
        charge = await conn.fetchrow(
            "select * from recurring_charges where id = $1 and tenant_id = $2", charge_id, current.tenant_id
        )
        if charge is None:
            raise HTTPException(status_code=404, detail="Cobrança recorrente não encontrada")

        transaction_id = await conn.fetchval(
            """
            insert into financial_transactions (tenant_id, patient_id, kind, amount_cents, due_date, category)
            values ($1, $2, $3, $4, $5, $6)
            returning id
            """,
            current.tenant_id,
            charge["patient_id"],
            charge["kind"],
            charge["amount_cents"],
            charge["next_due_date"],
            charge["category"],
        )
        next_due = _advance(charge["next_due_date"], charge["frequency"])
        await conn.execute(
            "update recurring_charges set next_due_date = $1 where id = $2", next_due, charge_id
        )
    return {"transaction_id": str(transaction_id), "next_due_date": next_due.isoformat()}
