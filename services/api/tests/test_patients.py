import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_create_list_update_delete_patient(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)

    create_res = await client.post("/patients", json={"name": "Maria Teste"}, headers=headers)
    assert create_res.status_code == 201
    patient = create_res.json()
    assert patient["status"] == "active"

    list_res = await client.get("/patients", headers=headers)
    assert list_res.status_code == 200
    assert any(p["id"] == patient["id"] for p in list_res.json())

    update_res = await client.patch(
        f"/patients/{patient['id']}", json={"status": "inactive"}, headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "inactive"

    active_res = await client.get("/patients?status=active", headers=headers)
    assert not any(p["id"] == patient["id"] for p in active_res.json())

    delete_res = await client.delete(f"/patients/{patient['id']}", headers=headers)
    assert delete_res.status_code == 204

    get_all_res = await client.get("/patients?status=all", headers=headers)
    assert not any(p["id"] == patient["id"] for p in get_all_res.json())


async def test_update_nonexistent_patient_returns_404(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    res = await client.patch(
        "/patients/00000000-0000-0000-0000-000000000000",
        json={"name": "Fantasma"},
        headers=auth_headers(token),
    )
    assert res.status_code == 404


async def test_search_filters_by_name(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)
    await client.post("/patients", json={"name": "Zebedeu Alcantara"}, headers=headers)
    await client.post("/patients", json={"name": "Outra Pessoa"}, headers=headers)

    res = await client.get("/patients?search=Zebedeu", headers=headers)
    names = [p["name"] for p in res.json()]
    assert names == ["Zebedeu Alcantara"]
