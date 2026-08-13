import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_generate_creates_pending_transaction_and_advances_monthly(
    client: AsyncClient, make_professional
):
    token, _ = await make_professional()
    headers = auth_headers(token)

    create_res = await client.post(
        "/recurring-charges",
        json={
            "description": "Pacote mensal de acompanhamento",
            "amount_cents": 20000,
            "category": "pacote",
            "frequency": "monthly",
            "next_due_date": "2026-01-31",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    charge_id = create_res.json()["id"]

    generate_res = await client.post(f"/recurring-charges/{charge_id}/generate", headers=headers)
    assert generate_res.status_code == 201
    body = generate_res.json()
    # 31/jan -> fevereiro não tem dia 31, cai pro último dia (28 em 2026, não bissexto)
    assert body["next_due_date"] == "2026-02-28"

    transactions_res = await client.get(
        f"/financial-transactions?category=pacote", headers=headers
    )
    transactions = transactions_res.json()
    assert len(transactions) == 1
    assert transactions[0]["amount_cents"] == 20000
    assert transactions[0]["paid_at"] is None
    assert transactions[0]["due_date"] == "2026-01-31"

    charge_res = await client.get("/recurring-charges", headers=headers)
    assert charge_res.json()[0]["next_due_date"] == "2026-02-28"
