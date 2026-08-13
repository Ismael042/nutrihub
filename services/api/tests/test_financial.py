import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_reports_aggregate_only_paid_transactions_by_category_and_month(
    client: AsyncClient, make_professional
):
    token, _ = await make_professional()
    headers = auth_headers(token)

    await client.post(
        "/financial-transactions",
        json={"kind": "income", "amount_cents": 10000, "category": "consulta", "paid_at": "2026-01-15T10:00:00Z"},
        headers=headers,
    )
    await client.post(
        "/financial-transactions",
        json={"kind": "income", "amount_cents": 5000, "category": "consulta", "paid_at": "2026-01-20T10:00:00Z"},
        headers=headers,
    )
    await client.post(
        "/financial-transactions",
        json={"kind": "expense", "amount_cents": 2000, "category": "material", "paid_at": "2026-02-01T10:00:00Z"},
        headers=headers,
    )
    await client.post(
        "/financial-transactions",
        json={"kind": "income", "amount_cents": 9999, "category": "ainda-nao-pago"},
        headers=headers,
    )

    by_category_res = await client.get("/financial-transactions/reports/by-category", headers=headers)
    assert by_category_res.status_code == 200
    rows = {(r["category"], r["kind"]): r for r in by_category_res.json()}
    assert rows[("consulta", "income")]["total_cents"] == 15000
    assert rows[("consulta", "income")]["count"] == 2
    assert rows[("material", "expense")]["total_cents"] == 2000
    assert ("ainda-nao-pago", "income") not in rows

    by_month_res = await client.get("/financial-transactions/reports/by-month", headers=headers)
    assert by_month_res.status_code == 200
    months = {r["month"]: r for r in by_month_res.json()}
    assert months["2026-01"]["income_cents"] == 15000
    assert months["2026-02"]["expense_cents"] == 2000
