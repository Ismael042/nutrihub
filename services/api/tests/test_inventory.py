import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_sell_decrements_stock_and_creates_paid_transaction(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)

    create_res = await client.post(
        "/inventory-items",
        json={"name": "Whey Protein 900g", "unit": "unidade", "quantity": 10, "unit_price_cents": 15000},
        headers=headers,
    )
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    sell_res = await client.post(f"/inventory-items/{item_id}/sell", json={"quantity": 2}, headers=headers)
    assert sell_res.status_code == 200
    body = sell_res.json()
    assert body["item"]["quantity"] == 8
    assert body["transaction_id"]

    transactions_res = await client.get(
        "/financial-transactions?category=Venda de produtos", headers=headers
    )
    transactions = transactions_res.json()
    assert len(transactions) == 1
    assert transactions[0]["amount_cents"] == 30000
    assert transactions[0]["paid_at"] is not None


async def test_sell_more_than_stock_is_rejected(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)
    create_res = await client.post(
        "/inventory-items",
        json={"name": "Creatina 300g", "quantity": 1, "unit_price_cents": 8000},
        headers=headers,
    )
    item_id = create_res.json()["id"]

    res = await client.post(f"/inventory-items/{item_id}/sell", json={"quantity": 5}, headers=headers)
    assert res.status_code == 422
