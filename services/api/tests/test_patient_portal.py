import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _create_patient_with_portal(client: AsyncClient, prof_headers: dict, email: str) -> str:
    create_res = await client.post(
        "/patients", json={"name": "Paciente Portal", "email": email}, headers=prof_headers
    )
    patient_id = create_res.json()["id"]
    access_res = await client.post(
        f"/patients/{patient_id}/portal-access", json={"password": "pacientesenha1"}, headers=prof_headers
    )
    assert access_res.status_code == 200, access_res.text
    return patient_id


async def test_patient_can_login_and_see_own_plan(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    prof_headers = auth_headers(token)
    email = "paciente.portal.test@example.com"
    patient_id = await _create_patient_with_portal(client, prof_headers, email)

    login_res = await client.post(
        "/patient-auth/login", json={"email": email, "password": "pacientesenha1"}
    )
    assert login_res.status_code == 200
    patient_token = login_res.json()["access_token"]
    patient_headers = auth_headers(patient_token)

    me_res = await client.get("/patient-portal/me", headers=patient_headers)
    assert me_res.status_code == 200
    assert me_res.json()["id"] == patient_id

    await client.post(
        "/diet-plans", json={"patient_id": patient_id, "name": "Plano de teste"}, headers=prof_headers
    )
    plans_res = await client.get("/patient-portal/diet-plans", headers=patient_headers)
    assert plans_res.status_code == 200
    assert len(plans_res.json()) == 1


async def test_patient_token_cannot_access_professional_routes(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    prof_headers = auth_headers(token)
    patient_id = await _create_patient_with_portal(client, prof_headers, "cross.role.test@example.com")

    login_res = await client.post(
        "/patient-auth/login", json={"email": "cross.role.test@example.com", "password": "pacientesenha1"}
    )
    patient_headers = auth_headers(login_res.json()["access_token"])

    res = await client.get("/patients", headers=patient_headers)
    assert res.status_code == 401


async def test_professional_token_cannot_access_patient_portal(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    res = await client.get("/patient-portal/me", headers=auth_headers(token))
    assert res.status_code == 401


async def test_login_fails_without_portal_access(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    prof_headers = auth_headers(token)
    await client.post(
        "/patients", json={"name": "Sem Portal", "email": "sem.portal.test@example.com"}, headers=prof_headers
    )
    res = await client.post(
        "/patient-auth/login", json={"email": "sem.portal.test@example.com", "password": "qualquer123"}
    )
    assert res.status_code == 401


async def test_revoke_portal_access_blocks_future_logins(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    prof_headers = auth_headers(token)
    email = "revoke.test@example.com"
    patient_id = await _create_patient_with_portal(client, prof_headers, email)

    revoke_res = await client.post(f"/patients/{patient_id}/portal-access/revoke", headers=prof_headers)
    assert revoke_res.status_code == 204

    login_res = await client.post(
        "/patient-auth/login", json={"email": email, "password": "pacientesenha1"}
    )
    assert login_res.status_code == 401
