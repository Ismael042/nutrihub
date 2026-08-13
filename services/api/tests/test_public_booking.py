import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_public_page_hidden_until_enabled(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)

    res = await client.get("/public/joice-nutri-test")
    assert res.status_code == 404

    await client.patch(
        "/me/public-profile",
        json={"public_slug": "joice-nutri-test", "bio": "Nutricionista clínica", "public_booking_enabled": True},
        headers=headers,
    )

    page_res = await client.get("/public/joice-nutri-test")
    assert page_res.status_code == 200
    assert page_res.json()["bio"] == "Nutricionista clínica"


async def test_rejects_invalid_slug(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    res = await client.patch(
        "/me/public-profile", json={"public_slug": "Com Espaço E Maiúscula"}, headers=auth_headers(token)
    )
    assert res.status_code == 422


async def test_full_booking_request_flow_creates_patient_and_appointment(
    client: AsyncClient, make_professional
):
    token, _ = await make_professional()
    headers = auth_headers(token)
    await client.patch(
        "/me/public-profile",
        json={"public_slug": "flow-test-nutri", "public_booking_enabled": True},
        headers=headers,
    )

    request_res = await client.post(
        "/public/flow-test-nutri/booking-requests",
        json={
            "patient_name": "Visitante Interessado",
            "patient_email": "visitante.test@example.com",
            "requested_at": "2026-03-10T14:00:00Z",
            "message": "Gostaria de agendar uma avaliação",
        },
    )
    assert request_res.status_code == 201
    request_id = request_res.json()["id"]

    list_res = await client.get("/booking-requests?status=pending", headers=headers)
    assert len(list_res.json()) == 1

    approve_res = await client.post(f"/booking-requests/{request_id}/approve", headers=headers)
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

    patients_res = await client.get("/patients?status=all&search=Visitante", headers=headers)
    assert len(patients_res.json()) == 1

    appointments_res = await client.get("/appointments", headers=headers)
    assert any(a["patient_name"] == "Visitante Interessado" for a in appointments_res.json())


async def test_reject_does_not_create_appointment(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)
    await client.patch(
        "/me/public-profile",
        json={"public_slug": "reject-test-nutri", "public_booking_enabled": True},
        headers=headers,
    )
    request_res = await client.post(
        "/public/reject-test-nutri/booking-requests",
        json={"patient_name": "Vai Ser Recusado", "requested_at": "2026-03-11T10:00:00Z"},
    )
    request_id = request_res.json()["id"]

    reject_res = await client.post(f"/booking-requests/{request_id}/reject", headers=headers)
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"

    appointments_res = await client.get("/appointments", headers=headers)
    assert not any(a["patient_name"] == "Vai Ser Recusado" for a in appointments_res.json())

    second_approve = await client.post(f"/booking-requests/{request_id}/approve", headers=headers)
    assert second_approve.status_code == 404
