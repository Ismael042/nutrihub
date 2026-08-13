import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_patient_logs_diary_and_professional_can_read_it(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    prof_headers = auth_headers(token)

    create_res = await client.post(
        "/patients", json={"name": "Paciente Diario", "email": "paciente.diario.test@example.com"}, headers=prof_headers
    )
    patient_id = create_res.json()["id"]
    await client.post(
        f"/patients/{patient_id}/portal-access", json={"password": "pacientesenha1"}, headers=prof_headers
    )
    login_res = await client.post(
        "/patient-auth/login",
        json={"email": "paciente.diario.test@example.com", "password": "pacientesenha1"},
    )
    patient_headers = auth_headers(login_res.json()["access_token"])

    log_res = await client.post(
        "/patient-portal/diary",
        json={"meal_kind": "breakfast", "description": "Omelete com aveia"},
        headers=patient_headers,
    )
    assert log_res.status_code == 201
    entry_id = log_res.json()["id"]

    my_diary = await client.get("/patient-portal/diary", headers=patient_headers)
    assert len(my_diary.json()) == 1

    prof_view = await client.get(f"/patients/{patient_id}/diary", headers=prof_headers)
    assert prof_view.status_code == 200
    assert prof_view.json()[0]["description"] == "Omelete com aveia"

    delete_res = await client.delete(f"/patient-portal/diary/{entry_id}", headers=patient_headers)
    assert delete_res.status_code == 204

    my_diary_after = await client.get("/patient-portal/diary", headers=patient_headers)
    assert len(my_diary_after.json()) == 0
