import base64
import io

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers
from tests.test_private_photos import PNG_1X1, FakePrivateStorage

pytestmark = pytest.mark.asyncio

PDF_MIN = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


@pytest.fixture
def fake_storage(monkeypatch):
    fake = FakePrivateStorage()
    # Constantes de anexo não existem no fake — vêm do módulo real.
    from app.core import storage as real

    fake.MAX_ATTACHMENT_BYTES = real.MAX_ATTACHMENT_BYTES
    fake.ACCEPTED_ATTACHMENT_TYPES = real.ACCEPTED_ATTACHMENT_TYPES
    for module in ("app.routers.anthropometry", "app.routers.lab_exams", "app.core.photos"):
        monkeypatch.setattr(f"{module}.storage", fake)
    return fake


async def _patient_and_measurement(client: AsyncClient, headers):
    patient_id = (await client.post("/patients", json={"name": "Evolução"}, headers=headers)).json()["id"]
    measurement_id = (
        await client.post(
            "/anthropometric-measurements",
            json={"patient_id": patient_id, "weight_kg": 70},
            headers=headers,
        )
    ).json()["id"]
    return patient_id, measurement_id


# ------------------------------------------------- fotos de evolução


async def test_measurement_photos_roundtrip(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id, measurement_id = await _patient_and_measurement(client, headers)

    res = await client.post(
        f"/anthropometric-measurements/{measurement_id}/photos",
        files={"file": ("frente.png", io.BytesIO(PNG_1X1), "image/png")},
        data={"kind": "front"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    photo = res.json()
    assert photo["kind"] == "front"
    assert photo["url"].startswith("https://signed.example/progress/")

    listed = (
        await client.get(f"/anthropometric-measurements?patient_id={patient_id}", headers=headers)
    ).json()
    assert len(listed[0]["photos"]) == 1
    assert listed[0]["photos"][0]["id"] == photo["id"]


async def test_multiple_photos_per_measurement(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id, measurement_id = await _patient_and_measurement(client, headers)

    for kind in ("front", "side", "back"):
        res = await client.post(
            f"/anthropometric-measurements/{measurement_id}/photos",
            files={"file": (f"{kind}.png", io.BytesIO(PNG_1X1), "image/png")},
            data={"kind": kind},
            headers=headers,
        )
        assert res.status_code == 201, res.text

    listed = (
        await client.get(f"/anthropometric-measurements?patient_id={patient_id}", headers=headers)
    ).json()
    assert {p["kind"] for p in listed[0]["photos"]} == {"front", "side", "back"}


async def test_delete_measurement_photo(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id, measurement_id = await _patient_and_measurement(client, headers)

    photo_id = (
        await client.post(
            f"/anthropometric-measurements/{measurement_id}/photos",
            files={"file": ("a.png", io.BytesIO(PNG_1X1), "image/png")},
            headers=headers,
        )
    ).json()["id"]

    res = await client.delete(
        f"/anthropometric-measurements/{measurement_id}/photos/{photo_id}", headers=headers
    )
    assert res.status_code == 204
    assert len(fake_storage.deleted) == 1

    listed = (
        await client.get(f"/anthropometric-measurements?patient_id={patient_id}", headers=headers)
    ).json()
    assert listed[0]["photos"] == []


async def test_deleting_measurement_also_deletes_photo_objects(
    client: AsyncClient, make_professional, fake_storage
):
    """Cascade limpa as linhas; os objetos no R2 precisam ser apagados na mão."""
    token, _ = await make_professional()
    headers = auth_headers(token)
    _, measurement_id = await _patient_and_measurement(client, headers)

    for _ in range(2):
        await client.post(
            f"/anthropometric-measurements/{measurement_id}/photos",
            files={"file": ("a.png", io.BytesIO(PNG_1X1), "image/png")},
            headers=headers,
        )

    res = await client.delete(f"/anthropometric-measurements/{measurement_id}", headers=headers)
    assert res.status_code == 204
    assert len(fake_storage.deleted) == 2


async def test_measurement_photo_isolated_between_tenants(
    client: AsyncClient, make_professional, fake_storage
):
    token_a, _ = await make_professional()
    token_b, _ = await make_professional()
    _, measurement_id = await _patient_and_measurement(client, auth_headers(token_a))

    res = await client.post(
        f"/anthropometric-measurements/{measurement_id}/photos",
        files={"file": ("a.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=auth_headers(token_b),
    )
    assert res.status_code == 404


async def test_measurement_photo_rejects_pdf(client: AsyncClient, make_professional, fake_storage):
    """Foto de evolução é imagem — PDF não entra aqui (só no anexo de exame)."""
    token, _ = await make_professional()
    headers = auth_headers(token)
    _, measurement_id = await _patient_and_measurement(client, headers)

    res = await client.post(
        f"/anthropometric-measurements/{measurement_id}/photos",
        files={"file": ("laudo.pdf", io.BytesIO(PDF_MIN), "application/pdf")},
        headers=headers,
    )
    assert res.status_code == 415


# ------------------------------------------------- anexo de exame


async def _exam_request(client: AsyncClient, headers) -> str:
    patient_id = (await client.post("/patients", json={"name": "Exames"}, headers=headers)).json()["id"]
    return (
        await client.post(
            "/lab-exam-requests",
            json={"patient_id": patient_id, "exams": [{"name": "Hemograma"}]},
            headers=headers,
        )
    ).json()["id"]


async def test_attachment_accepts_pdf(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    exam_id = await _exam_request(client, headers)

    res = await client.post(
        f"/lab-exam-requests/{exam_id}/attachments",
        files={"file": ("laudo.pdf", io.BytesIO(PDF_MIN), "application/pdf")},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["content_type"] == "application/pdf"
    assert body["filename"] == "laudo.pdf"
    assert body["size_bytes"] == len(PDF_MIN)
    assert body["url"].startswith("https://signed.example/exams/")

    listed = (await client.get("/lab-exam-requests", headers=headers)).json()
    assert len(listed[0]["attachments"]) == 1


async def test_attachment_accepts_image(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    exam_id = await _exam_request(client, headers)

    res = await client.post(
        f"/lab-exam-requests/{exam_id}/attachments",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["content_type"] == "image/png"


async def test_attachment_type_comes_from_bytes_not_client_header(
    client: AsyncClient, make_professional, fake_storage
):
    """Cliente mentindo no Content-Type não define como o objeto será servido."""
    token, _ = await make_professional()
    headers = auth_headers(token)
    exam_id = await _exam_request(client, headers)

    # Bytes de PDF, mas alegando ser PNG: o tipo gravado tem que ser o real.
    res = await client.post(
        f"/lab-exam-requests/{exam_id}/attachments",
        files={"file": ("disfarce.png", io.BytesIO(PDF_MIN), "image/png")},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["content_type"] == "application/pdf"


async def test_attachment_rejects_garbage_bytes(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    exam_id = await _exam_request(client, headers)

    res = await client.post(
        f"/lab-exam-requests/{exam_id}/attachments",
        files={"file": ("fake.pdf", io.BytesIO(b"nem pdf nem imagem" * 20), "application/pdf")},
        headers=headers,
    )
    assert res.status_code == 415


async def test_attachment_rejects_disallowed_type(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    exam_id = await _exam_request(client, headers)

    res = await client.post(
        f"/lab-exam-requests/{exam_id}/attachments",
        files={"file": ("script.sh", io.BytesIO(b"#!/bin/sh\nrm -rf /"), "text/x-shellscript")},
        headers=headers,
    )
    assert res.status_code == 415


async def test_attachment_delete_and_cascade(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    exam_id = await _exam_request(client, headers)

    att_id = (
        await client.post(
            f"/lab-exam-requests/{exam_id}/attachments",
            files={"file": ("laudo.pdf", io.BytesIO(PDF_MIN), "application/pdf")},
            headers=headers,
        )
    ).json()["id"]

    res = await client.delete(f"/lab-exam-requests/{exam_id}/attachments/{att_id}", headers=headers)
    assert res.status_code == 204
    assert len(fake_storage.deleted) == 1

    # Novo anexo + apagar o pedido inteiro: o objeto também tem que sumir.
    await client.post(
        f"/lab-exam-requests/{exam_id}/attachments",
        files={"file": ("outro.pdf", io.BytesIO(PDF_MIN), "application/pdf")},
        headers=headers,
    )
    await client.delete(f"/lab-exam-requests/{exam_id}", headers=headers)
    assert len(fake_storage.deleted) == 2


async def test_attachment_isolated_between_tenants(client: AsyncClient, make_professional, fake_storage):
    token_a, _ = await make_professional()
    token_b, _ = await make_professional()
    exam_id = await _exam_request(client, auth_headers(token_a))

    res = await client.post(
        f"/lab-exam-requests/{exam_id}/attachments",
        files={"file": ("laudo.pdf", io.BytesIO(PDF_MIN), "application/pdf")},
        headers=auth_headers(token_b),
    )
    assert res.status_code == 404
