import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_professional_and_patient_can_exchange_messages(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    prof_headers = auth_headers(token)

    create_res = await client.post(
        "/patients", json={"name": "Paciente Chat", "email": "paciente.chat.test@example.com"}, headers=prof_headers
    )
    patient_id = create_res.json()["id"]
    await client.post(
        f"/patients/{patient_id}/portal-access", json={"password": "pacientesenha1"}, headers=prof_headers
    )
    login_res = await client.post(
        "/patient-auth/login",
        json={"email": "paciente.chat.test@example.com", "password": "pacientesenha1"},
    )
    patient_headers = auth_headers(login_res.json()["access_token"])

    send_res = await client.post(
        f"/patients/{patient_id}/chat", json={"content": "Olá, como você está?"}, headers=prof_headers
    )
    assert send_res.status_code == 201
    assert send_res.json()["sender"] == "professional"

    reply_res = await client.post(
        "/patient-portal/chat", json={"content": "Tudo bem, obrigado!"}, headers=patient_headers
    )
    assert reply_res.status_code == 201
    assert reply_res.json()["sender"] == "patient"

    prof_view = await client.get(f"/patients/{patient_id}/chat", headers=prof_headers)
    assert [m["content"] for m in prof_view.json()] == ["Olá, como você está?", "Tudo bem, obrigado!"]

    patient_view = await client.get("/patient-portal/chat", headers=patient_headers)
    assert [m["content"] for m in patient_view.json()] == ["Olá, como você está?", "Tudo bem, obrigado!"]


async def test_chat_is_isolated_per_tenant(client: AsyncClient, make_professional):
    token_a, _ = await make_professional()
    token_b, _ = await make_professional()

    create_res = await client.post(
        "/patients", json={"name": "Paciente A"}, headers=auth_headers(token_a)
    )
    patient_id = create_res.json()["id"]
    await client.post(f"/patients/{patient_id}/chat", json={"content": "Secreto"}, headers=auth_headers(token_a))

    res_b = await client.get(f"/patients/{patient_id}/chat", headers=auth_headers(token_b))
    assert res_b.status_code == 404
