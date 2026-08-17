import base64
import io

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

# PNG 1x1 real — passa pelo normalize_avatar de verdade (não mockado), então o teste
# exercita a validação/re-encode do Pillow em vez de fingir que ela existe.
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)

FAKE_BASE = "https://cdn.example.test"


class FakeStorage:
    """Substitui app.core.storage nos testes — nada aqui toca no R2 de verdade."""

    MAX_UPLOAD_BYTES = 3 * 1024 * 1024
    ACCEPTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
    InvalidImageError = Exception  # sobrescrito no _install pelo real

    def __init__(self):
        self.deleted: list[str] = []
        self.counter = 0
        self.configured = True

    def is_configured(self) -> bool:
        return self.configured

    async def put_avatar(self, professional_id, data: bytes) -> str:
        self.counter += 1
        return f"{FAKE_BASE}/avatars/{professional_id}/foto{self.counter}.jpg"

    async def delete_by_public_url(self, url: str | None) -> None:
        if url:
            self.deleted.append(url)


@pytest.fixture
def fake_storage(monkeypatch):
    from app.core import storage as real_storage

    fake = FakeStorage()
    fake.InvalidImageError = real_storage.InvalidImageError
    # normalize_avatar continua sendo o real: valida de verdade os bytes recebidos.
    fake.normalize_avatar = real_storage.normalize_avatar
    monkeypatch.setattr("app.routers.public_profile.storage", fake)
    return fake


async def test_upload_stores_url_and_public_page_exposes_it(
    client: AsyncClient, make_professional, fake_storage
):
    token, _ = await make_professional()
    headers = auth_headers(token)

    res = await client.post(
        "/me/public-profile/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    photo_url = res.json()["photo_url"]
    assert photo_url.startswith(FAKE_BASE)

    me_res = await client.get("/me/public-profile", headers=headers)
    assert me_res.json()["photo_url"] == photo_url

    await client.patch(
        "/me/public-profile",
        json={"public_slug": "foto-teste-nutri", "public_booking_enabled": True},
        headers=headers,
    )
    public_res = await client.get("/public/foto-teste-nutri")
    assert public_res.status_code == 200
    assert public_res.json()["photo_url"] == photo_url


async def test_upload_rejects_non_image(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    res = await client.post(
        "/me/public-profile/photo",
        files={"file": ("bio.txt", io.BytesIO(b"nao sou imagem"), "text/plain")},
        headers=auth_headers(token),
    )
    assert res.status_code == 415


async def test_upload_rejects_image_content_type_with_garbage_bytes(
    client: AsyncClient, make_professional, fake_storage
):
    """Content-Type mentindo não passa: quem decide é o decode, não o header."""
    token, _ = await make_professional()
    res = await client.post(
        "/me/public-profile/photo",
        files={"file": ("fake.png", io.BytesIO(b"PNG mentiroso" * 50), "image/png")},
        headers=auth_headers(token),
    )
    assert res.status_code == 415


async def test_upload_rejects_oversized_file(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    oversized = b"\x00" * (4 * 1024 * 1024)
    res = await client.post(
        "/me/public-profile/photo",
        files={"file": ("grande.jpg", io.BytesIO(oversized), "image/jpeg")},
        headers=auth_headers(token),
    )
    assert res.status_code == 413


async def test_upload_returns_503_when_storage_unconfigured(
    client: AsyncClient, make_professional, fake_storage
):
    fake_storage.configured = False
    token, _ = await make_professional()
    res = await client.post(
        "/me/public-profile/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=auth_headers(token),
    )
    assert res.status_code == 503


async def test_replacing_photo_deletes_previous_object(
    client: AsyncClient, make_professional, fake_storage
):
    token, _ = await make_professional()
    headers = auth_headers(token)

    first = await client.post(
        "/me/public-profile/photo",
        files={"file": ("a.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    first_url = first.json()["photo_url"]

    second = await client.post(
        "/me/public-profile/photo",
        files={"file": ("b.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    assert second.json()["photo_url"] != first_url
    assert first_url in fake_storage.deleted


async def test_delete_photo_clears_column_and_is_idempotent(
    client: AsyncClient, make_professional, fake_storage
):
    token, _ = await make_professional()
    headers = auth_headers(token)

    upload = await client.post(
        "/me/public-profile/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    uploaded_url = upload.json()["photo_url"]

    res = await client.delete("/me/public-profile/photo", headers=headers)
    assert res.status_code == 200
    assert res.json()["photo_url"] is None
    assert uploaded_url in fake_storage.deleted

    again = await client.delete("/me/public-profile/photo", headers=headers)
    assert again.status_code == 200
    assert again.json()["photo_url"] is None


async def test_patch_cannot_set_photo_url(client: AsyncClient, make_professional, fake_storage):
    """Forma executável do comentário da migration 0018.

    photo_url fora de PublicProfileUpdate: o pydantic descarta a chave desconhecida,
    o exclude_unset devolve {} e o PATCH cai no "nenhum campo para atualizar" — ou
    seja, não existe caminho pra apontar a foto pública pra URL de terceiro.
    """
    token, _ = await make_professional()
    headers = auth_headers(token)

    upload = await client.post(
        "/me/public-profile/photo",
        files={"file": ("foto.png", io.BytesIO(PNG_1X1), "image/png")},
        headers=headers,
    )
    real_url = upload.json()["photo_url"]

    res = await client.patch(
        "/me/public-profile",
        json={"photo_url": "https://evil.example/rastreador.jpg"},
        headers=headers,
    )
    assert res.status_code == 422

    me_res = await client.get("/me/public-profile", headers=headers)
    assert me_res.json()["photo_url"] == real_url


async def test_patch_rejects_bio_over_limit(client: AsyncClient, make_professional, fake_storage):
    token, _ = await make_professional()
    res = await client.patch(
        "/me/public-profile",
        json={"bio": "a" * 801},
        headers=auth_headers(token),
    )
    assert res.status_code == 422
