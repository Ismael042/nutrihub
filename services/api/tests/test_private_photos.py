import base64
import io

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


class FakePrivateStorage:
    """Substitui app.core.storage nos módulos que fazem upload privado.

    Nenhum teste toca no R2 real, mas normalize_avatar/normalize_logo continuam sendo
    os de verdade — então a validação/re-encode do Pillow é exercitada.
    """

    MAX_UPLOAD_BYTES = 3 * 1024 * 1024
    ACCEPTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

    def __init__(self):
        from app.core import storage as real

        self.InvalidImageError = real.InvalidImageError
        self.normalize_avatar = real.normalize_avatar
        self.normalize_logo = real.normalize_logo
        self.deleted: list[str] = []
        self.objects: dict[str, bytes] = {}
        self.counter = 0
        self.configured = True

    def is_private_configured(self) -> bool:
        return self.configured

    async def put_private(self, prefix, owner_id, data, *, content_type="image/jpeg"):
        self.counter += 1
        key = f"{prefix}/{owner_id}/obj{self.counter}"
        self.objects[key] = data
        return key

    def presigned_get_url(self, key, expires_in=3600):
        return f"https://signed.example/{key}?sig=abc" if key else None

    async def get_private_bytes(self, key):
        return self.objects.get(key) if key else None

    async def delete_private(self, key):
        if key:
            self.deleted.append(key)
            self.objects.pop(key, None)


@pytest.fixture
def fake_storage(monkeypatch):
    fake = FakePrivateStorage()
    for module in (
        "app.routers.patients",
        "app.routers.recipes",
        "app.routers.tenant_settings",
        "app.core.photos",
        "app.routers.diet_plans",
    ):
        monkeypatch.setattr(f"{module}.storage", fake)
    return fake


async def _create_patient(client: AsyncClient, headers) -> str:
    res = await client.post("/patients", json={"name": "Paciente Foto"}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ---------------------------------------------------------------- paciente


async def test_patient_photo_roundtrip_and_signed_url(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)

    res = await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    photo_url = res.json()["photo_url"]
    # URL assinada, não link permanente — é o ponto da coluna guardar a chave.
    assert photo_url.startswith("https://signed.example/patients/")
    assert "sig=" in photo_url

    get_res = await client.get(f"/patients/{patient_id}", headers=headers)
    assert get_res.json()["photo_url"] == photo_url

    list_res = await client.get("/patients?status=all", headers=headers)
    assert any(p["photo_url"] == photo_url for p in list_res.json())


async def test_patient_photo_replace_deletes_previous(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)

    first = await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("a.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    second = await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("b.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert second.json()["photo_url"] != first.json()["photo_url"]
    assert len(fake_storage.deleted) == 1


async def test_patient_photo_delete_is_idempotent(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)

    await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    res = await client.delete(f"/patients/{patient_id}/photo", headers=headers)
    assert res.status_code == 200
    assert res.json()["photo_url"] is None

    again = await client.delete(f"/patients/{patient_id}/photo", headers=headers)
    assert again.status_code == 200


async def test_patient_photo_isolated_between_tenants(client: AsyncClient, make_professional, fake_storage):
    token_a, _ = await make_professional()
    token_b, _ = await make_professional()
    patient_id = await _create_patient(client, auth_headers(token_a))

    res = await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=auth_headers(token_b),
    )
    assert res.status_code == 404


async def test_patch_cannot_set_patient_photo_key(client: AsyncClient, make_professional, fake_storage):
    """photo_key fora de PatientUpdate: o SET do PATCH é montado a partir das chaves
    daquele modelo, então não existe caminho pra apontar a foto pra objeto arbitrário."""
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)

    await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    real_url = (await client.get(f"/patients/{patient_id}", headers=headers)).json()["photo_url"]

    res = await client.patch(
        f"/patients/{patient_id}",
        json={"photo_key": "logos/outro-tenant/segredo"},
        headers=headers,
    )
    assert res.status_code == 422

    assert (await client.get(f"/patients/{patient_id}", headers=headers)).json()["photo_url"] == real_url


async def test_patient_photo_rejects_non_image(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)
    res = await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("nota.txt", io.BytesIO(b"nao sou imagem"), "text/plain")},
        headers=headers,
    )
    assert res.status_code == 415


async def test_patient_photo_rejects_oversized(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)
    res = await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("grande.jpg", io.BytesIO(b"\x00" * (4 * 1024 * 1024)), "image/jpeg")},
        headers=headers,
    )
    assert res.status_code == 413


async def test_patient_photo_503_when_unconfigured(client: AsyncClient, make_professional, fake_storage):
    fake_storage.configured = False
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)
    res = await client.post(
        f"/patients/{patient_id}/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert res.status_code == 503


# ---------------------------------------------------------------- receita


async def test_recipe_photo_roundtrip(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    headers = auth_headers(token)
    recipe_id = (await client.post("/recipes", json={"name": "Panqueca"}, headers=headers)).json()["id"]

    res = await client.post(
        f"/recipes/{recipe_id}/photo",
        files={"file": ("prato.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["photo_url"].startswith("https://signed.example/recipes/")

    listed = (await client.get("/recipes", headers=headers)).json()
    assert any(r["photo_url"] for r in listed if r["id"] == recipe_id)

    deleted = await client.delete(f"/recipes/{recipe_id}/photo", headers=headers)
    assert deleted.json()["photo_url"] is None


# ---------------------------------------------------------------- logo do tenant


async def test_tenant_logo_roundtrip_through_rls_connection(
    client: AsyncClient, make_professional, fake_storage
):
    """Também cobre o bloqueador da migration 0019: `tenants` tinha RLS habilitado sem
    policy nenhuma, então esta rota (que usa tenant_connection, a role com RLS) não
    conseguia nem ler a linha do próprio consultório."""
    token, _ = await make_professional()
    headers = auth_headers(token)

    me = await client.get("/me/tenant", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["logo_url"] is None
    assert me.json()["name"]

    res = await client.post(
        "/me/tenant/logo",
        files={"file": ("logo.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["logo_url"].startswith("https://signed.example/logos/")

    assert (await client.get("/me/tenant", headers=headers)).json()["logo_url"] is not None

    removed = await client.delete("/me/tenant/logo", headers=headers)
    assert removed.json()["logo_url"] is None
    assert len(fake_storage.deleted) == 1


async def test_diet_plan_pdf_works_with_and_without_logo(client: AsyncClient, make_professional, fake_storage):
    """Logo é enfeite: PDF tem que sair nos dois casos."""
    token, _ = await make_professional()
    headers = auth_headers(token)
    patient_id = await _create_patient(client, headers)
    plan_id = (
        await client.post(
            "/diet-plans", json={"patient_id": patient_id, "name": "Plano 1"}, headers=headers
        )
    ).json()["id"]

    without = await client.get(f"/diet-plans/{plan_id}/pdf", headers=headers)
    assert without.status_code == 200
    assert without.content.startswith(b"%PDF")

    await client.post(
        "/me/tenant/logo",
        files={"file": ("logo.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    with_logo = await client.get(f"/diet-plans/{plan_id}/pdf", headers=headers)
    assert with_logo.status_code == 200
    assert with_logo.content.startswith(b"%PDF")
