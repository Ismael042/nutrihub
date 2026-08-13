from datetime import date, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/financial-transactions", tags=["financial"])

Kind = Literal["income", "expense"]
PaymentStatus = Literal["paid", "pending"]


class TransactionCreate(BaseModel):
    patient_id: UUID | None = None
    kind: Kind
    amount_cents: int
    due_date: date | None = None
    paid_at: datetime | None = None
    category: str | None = None


class TransactionUpdate(BaseModel):
    amount_cents: int | None = None
    due_date: date | None = None
    paid_at: datetime | None = None
    category: str | None = None


class TransactionOut(BaseModel):
    id: UUID
    patient_id: UUID | None
    patient_name: str | None
    kind: str
    amount_cents: int
    due_date: date | None
    paid_at: datetime | None
    created_at: datetime
    category: str | None


class SummaryOut(BaseModel):
    income_paid_cents: int
    expense_paid_cents: int
    balance_cents: int
    pending_count: int
    pending_cents: int


class CategoryReportRow(BaseModel):
    category: str
    kind: str
    total_cents: int
    count: int


class MonthlyReportRow(BaseModel):
    month: str
    income_cents: int
    expense_cents: int


SELECT_TRANSACTION = """
    select
        t.id, t.patient_id, p.name as patient_name,
        t.kind, t.amount_cents, t.due_date, t.paid_at, t.created_at, t.category
    from financial_transactions t
    left join patients p on p.id = t.patient_id
"""


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    current: CurrentProfessional = Depends(get_current_professional),
    kind: Kind | None = None,
    status_filter: PaymentStatus | None = Query(None, alias="status"),
    patient_id: UUID | None = None,
    category: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[TransactionOut]:
    conditions = ["t.tenant_id = $1"]
    params: list = [current.tenant_id]

    if kind:
        params.append(kind)
        conditions.append(f"t.kind = ${len(params)}")

    if status_filter == "paid":
        conditions.append("t.paid_at is not null")
    elif status_filter == "pending":
        conditions.append("t.paid_at is null")

    if patient_id:
        params.append(patient_id)
        conditions.append(f"t.patient_id = ${len(params)}")

    if category:
        params.append(category)
        conditions.append(f"t.category = ${len(params)}")

    params.extend([limit, offset])
    query = (
        f"{SELECT_TRANSACTION} where {' and '.join(conditions)} "
        f"order by coalesce(t.due_date, t.created_at::date) desc limit ${len(params) - 1} offset ${len(params)}"
    )

    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)

    return [TransactionOut(**dict(row)) for row in rows]


@router.get("/summary", response_model=SummaryOut)
async def summary(current: CurrentProfessional = Depends(get_current_professional)) -> SummaryOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            select
                coalesce(sum(amount_cents) filter (where kind = 'income' and paid_at is not null), 0) as income_paid_cents,
                coalesce(sum(amount_cents) filter (where kind = 'expense' and paid_at is not null), 0) as expense_paid_cents,
                count(*) filter (where paid_at is null) as pending_count,
                coalesce(sum(amount_cents) filter (where paid_at is null), 0) as pending_cents
            from financial_transactions
            where tenant_id = $1
            """,
            current.tenant_id,
        )
    income = row["income_paid_cents"]
    expense = row["expense_paid_cents"]
    return SummaryOut(
        income_paid_cents=income,
        expense_paid_cents=expense,
        balance_cents=income - expense,
        pending_count=row["pending_count"],
        pending_cents=row["pending_cents"],
    )


@router.get("/reports/by-category", response_model=list[CategoryReportRow])
async def report_by_category(
    current: CurrentProfessional = Depends(get_current_professional),
) -> list[CategoryReportRow]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            """
            select coalesce(category, 'Sem categoria') as category, kind,
                   sum(amount_cents) as total_cents, count(*) as count
            from financial_transactions
            where tenant_id = $1 and paid_at is not null
            group by coalesce(category, 'Sem categoria'), kind
            order by total_cents desc
            """,
            current.tenant_id,
        )
    return [CategoryReportRow(**dict(row)) for row in rows]


@router.get("/reports/by-month", response_model=list[MonthlyReportRow])
async def report_by_month(
    current: CurrentProfessional = Depends(get_current_professional),
) -> list[MonthlyReportRow]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            """
            select
                to_char(coalesce(paid_at::date, due_date, created_at::date), 'YYYY-MM') as month,
                coalesce(sum(amount_cents) filter (where kind = 'income'), 0) as income_cents,
                coalesce(sum(amount_cents) filter (where kind = 'expense'), 0) as expense_cents
            from financial_transactions
            where tenant_id = $1 and paid_at is not null
            group by month
            order by month
            """,
            current.tenant_id,
        )
    return [MonthlyReportRow(**dict(row)) for row in rows]


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> TransactionOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        if payload.patient_id:
            patient = await conn.fetchval(
                "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
            )
            if patient is None:
                raise HTTPException(status_code=422, detail="Paciente não encontrado")

        transaction_id = await conn.fetchval(
            """
            insert into financial_transactions (tenant_id, patient_id, kind, amount_cents, due_date, paid_at, category)
            values ($1, $2, $3, $4, $5, $6, $7)
            returning id
            """,
            current.tenant_id,
            payload.patient_id,
            payload.kind,
            payload.amount_cents,
            payload.due_date,
            payload.paid_at,
            payload.category,
        )
        row = await conn.fetchrow(f"{SELECT_TRANSACTION} where t.id = $1", transaction_id)

    return TransactionOut(**dict(row))


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: UUID,
    payload: TransactionUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> TransactionOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")

    set_clauses = []
    params: list = [transaction_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")

    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            f"""
            update financial_transactions set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning id
            """,
            *params,
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Lançamento não encontrado")
        row = await conn.fetchrow(f"{SELECT_TRANSACTION} where t.id = $1", updated_id)

    return TransactionOut(**dict(row))


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from financial_transactions where id = $1 and tenant_id = $2", transaction_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
