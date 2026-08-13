import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_food_full_crud_and_public_foods_are_read_only(client: AsyncClient, make_professional):
    """Regressão do bug achado manualmente nesta rodada: DELETE (e PATCH) em `foods`
    ficou bloqueado por RLS porque a policy original (0001) só previa
    select/insert/update — sem policy de delete, Postgres nega por padrão. Corrigido em
    0004_delete_policies.sql. Esse teste trava esse comportamento pra não regredir.
    """
    token, _ = await make_professional()
    headers = auth_headers(token)

    create_res = await client.post(
        "/foods", json={"name": "Alimento QA", "kcal": 100}, headers=headers
    )
    assert create_res.status_code == 201
    food = create_res.json()
    assert food["source"] == "custom"

    patch_res = await client.patch(f"/foods/{food['id']}", json={"kcal": 200}, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["kcal"] == 200

    delete_res = await client.delete(f"/foods/{food['id']}", headers=headers)
    assert delete_res.status_code == 204

    public_list = await client.get("/foods?search=Arroz", headers=headers)
    public_food = next((f for f in public_list.json() if f["tenant_id"] is None), None)
    assert public_food is not None, "seed público (fonte taco) deveria estar visível"

    patch_public = await client.patch(
        f"/foods/{public_food['id']}", json={"kcal": 1}, headers=headers
    )
    assert patch_public.status_code == 404

    delete_public = await client.delete(f"/foods/{public_food['id']}", headers=headers)
    assert delete_public.status_code == 404


async def test_substitution_list_own_crud_and_system_lists_are_protected(
    client: AsyncClient, make_professional
):
    token, _ = await make_professional()
    headers = auth_headers(token)

    create_res = await client.post(
        "/substitution-lists",
        json={"category": "teste", "name": "Lista QA", "items": [{"name": "Item", "portion": "1x"}]},
        headers=headers,
    )
    assert create_res.status_code == 201
    own_list = create_res.json()

    patch_res = await client.patch(
        f"/substitution-lists/{own_list['id']}", json={"name": "Lista QA Editada"}, headers=headers
    )
    assert patch_res.status_code == 200

    delete_res = await client.delete(f"/substitution-lists/{own_list['id']}", headers=headers)
    assert delete_res.status_code == 204

    all_lists = await client.get("/substitution-lists", headers=headers)
    system_list = next((l for l in all_lists.json() if l["tenant_id"] is None), None)
    assert system_list is not None, "os 4 modelos padrão deveriam estar visíveis"

    patch_system = await client.patch(
        f"/substitution-lists/{system_list['id']}", json={"name": "Hackeado"}, headers=headers
    )
    assert patch_system.status_code == 404

    delete_system = await client.delete(f"/substitution-lists/{system_list['id']}", headers=headers)
    assert delete_system.status_code == 404


async def test_pagination_limit_is_respected(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)
    for i in range(3):
        await client.post("/recipes", json={"name": f"Receita {i}"}, headers=headers)

    res = await client.get("/recipes?limit=2", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) <= 2
