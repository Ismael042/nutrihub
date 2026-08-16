from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.core import db
from tests.conftest import fake_cpf

pytestmark = pytest.mark.asyncio


async def _noop_send(**kwargs) -> None:
    pass


async def _signup(client: AsyncClient, monkeypatch, *, suffix: str, cpf: str | None = None):
    captured: dict[str, str] = {}

    async def _fake_send(*, to: str, name: str, code: str) -> None:
        captured[to] = code

    monkeypatch.setattr("app.routers.auth.send_verification_email", _fake_send)

    email = f"sv.{suffix}@example.com"
    res = await client.post(
        "/auth/signup",
        json={
            "name": f"Verificação {suffix}",
            "email": email,
            "password": "senha1234",
            "cpf": cpf or fake_cpf(suffix),
        },
    )
    return res, email, captured


async def test_signup_does_not_return_token(client: AsyncClient, monkeypatch):
    res, email, captured = await _signup(client, monkeypatch, suffix="happy1")
    assert res.status_code == 201, res.text
    body = res.json()
    assert set(body.keys()) == {"professional_id", "email"}
    assert body["email"] == email
    assert email in captured


async def test_full_verification_flow_issues_working_token(client: AsyncClient, monkeypatch):
    res, email, captured = await _signup(client, monkeypatch, suffix="happy2")
    professional_id = res.json()["professional_id"]

    verify_res = await client.post(
        "/auth/verify-email", json={"professional_id": professional_id, "code": captured[email]}
    )
    assert verify_res.status_code == 200, verify_res.text
    token = verify_res.json()["access_token"]

    me_res = await client.get("/appointments", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200


async def test_wrong_code_locks_out_after_five_attempts(client: AsyncClient, monkeypatch):
    res, email, captured = await _signup(client, monkeypatch, suffix="lockout1")
    professional_id = res.json()["professional_id"]

    for _ in range(5):
        wrong_res = await client.post(
            "/auth/verify-email", json={"professional_id": professional_id, "code": "000000"}
        )
        assert wrong_res.status_code == 401

    locked_res = await client.post(
        "/auth/verify-email", json={"professional_id": professional_id, "code": captured[email]}
    )
    assert locked_res.status_code == 429


async def test_expired_code_is_rejected(client: AsyncClient, monkeypatch):
    res, email, captured = await _signup(client, monkeypatch, suffix="expired1")
    professional_id = res.json()["professional_id"]

    async with db.pool().acquire() as conn:
        await conn.execute(
            "update email_verification_codes set expires_at = $1 where professional_id = $2",
            datetime.now(timezone.utc) - timedelta(minutes=1),
            professional_id,
        )

    expired_res = await client.post(
        "/auth/verify-email", json={"professional_id": professional_id, "code": captured[email]}
    )
    assert expired_res.status_code == 410


async def test_resend_code_respects_cooldown_then_works(client: AsyncClient, monkeypatch):
    res, email, captured = await _signup(client, monkeypatch, suffix="resend1")
    professional_id = res.json()["professional_id"]
    first_code = captured[email]

    immediate_res = await client.post("/auth/resend-code", json={"professional_id": professional_id})
    assert immediate_res.status_code == 429

    async with db.pool().acquire() as conn:
        await conn.execute(
            "update email_verification_codes set last_sent_at = $1 where professional_id = $2",
            datetime.now(timezone.utc) - timedelta(seconds=61),
            professional_id,
        )

    resend_res = await client.post("/auth/resend-code", json={"professional_id": professional_id})
    assert resend_res.status_code == 204
    new_code = captured[email]
    assert new_code != first_code

    old_code_res = await client.post(
        "/auth/verify-email", json={"professional_id": professional_id, "code": first_code}
    )
    assert old_code_res.status_code == 401

    new_code_res = await client.post(
        "/auth/verify-email", json={"professional_id": professional_id, "code": new_code}
    )
    assert new_code_res.status_code == 200


async def test_duplicate_email_returns_409(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.auth.send_verification_email", _noop_send)
    email = "sv.dup-email@example.com"
    first = await client.post(
        "/auth/signup",
        json={"name": "Dup", "email": email, "password": "senha1234", "cpf": fake_cpf("dupemail1")},
    )
    assert first.status_code == 201
    second = await client.post(
        "/auth/signup",
        json={"name": "Dup", "email": email, "password": "senha1234", "cpf": fake_cpf("dupemail2")},
    )
    assert second.status_code == 409
    assert "E-mail" in second.json()["detail"]


async def test_duplicate_cpf_returns_409(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.auth.send_verification_email", _noop_send)
    cpf = fake_cpf("dupcpf")
    first = await client.post(
        "/auth/signup",
        json={"name": "Dup CPF", "email": "sv.dupcpf1@example.com", "password": "senha1234", "cpf": cpf},
    )
    assert first.status_code == 201
    second = await client.post(
        "/auth/signup",
        json={"name": "Dup CPF", "email": "sv.dupcpf2@example.com", "password": "senha1234", "cpf": cpf},
    )
    assert second.status_code == 409
    assert "CPF" in second.json()["detail"]


@pytest.mark.parametrize("bad_cpf", ["12345678900", "00000000000", "123", "abcdefghijk"])
async def test_invalid_cpf_returns_422(client: AsyncClient, bad_cpf: str):
    res = await client.post(
        "/auth/signup",
        json={"name": "Bad CPF", "email": "sv.badcpf@example.com", "password": "senha1234", "cpf": bad_cpf},
    )
    assert res.status_code == 422


async def test_login_before_verification_is_blocked(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.auth.send_verification_email", _noop_send)
    email = "sv.unverified@example.com"
    await client.post(
        "/auth/signup",
        json={"name": "Unverified", "email": email, "password": "senha1234", "cpf": fake_cpf("unverified")},
    )

    login_res = await client.post("/auth/login", json={"email": email, "password": "senha1234"})
    assert login_res.status_code == 403


async def test_google_signup_without_cpf_requires_cpf(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(
        "app.routers.auth.google_id_token.verify_oauth2_token",
        lambda *a, **k: {"sub": "google-new-1", "email": "sv.google1@example.com", "name": "Google One"},
    )
    res = await client.post("/auth/google", json={"id_token": "fake"})
    assert res.status_code == 422
    assert res.json()["detail"] == "cpf_required"


async def test_google_signup_with_cpf_issues_token_and_skips_verification(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(
        "app.routers.auth.google_id_token.verify_oauth2_token",
        lambda *a, **k: {"sub": "google-new-2", "email": "sv.google2@example.com", "name": "Google Two"},
    )
    res = await client.post("/auth/google", json={"id_token": "fake", "cpf": fake_cpf("googlenew2")})
    assert res.status_code == 200, res.text
    assert res.json()["access_token"]


async def test_google_links_existing_email_password_account(client: AsyncClient, monkeypatch):
    res, email, captured = await _signup(client, monkeypatch, suffix="linkme")
    professional_id = res.json()["professional_id"]
    await client.post(
        "/auth/verify-email", json={"professional_id": professional_id, "code": captured[email]}
    )

    monkeypatch.setattr(
        "app.routers.auth.google_id_token.verify_oauth2_token",
        lambda *a, **k: {"sub": "google-link-1", "email": email, "name": "Linked"},
    )
    google_res = await client.post("/auth/google", json={"id_token": "fake"})
    assert google_res.status_code == 200, google_res.text

    second_res = await client.post("/auth/google", json={"id_token": "fake"})
    assert second_res.status_code == 200
