import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, fake_cpf

pytestmark = pytest.mark.asyncio


async def test_signup_creates_professional_and_returns_token(client: AsyncClient, make_professional):
    token, professional = await make_professional()
    assert token
    assert professional["tenant_id"]


async def test_signup_rejects_short_password(client: AsyncClient):
    res = await client.post(
        "/auth/signup",
        json={"name": "Curto", "email": f"curto.{uuid.uuid4().hex[:8]}@example.com", "password": "123"},
    )
    assert res.status_code == 422


async def test_signup_rejects_duplicate_email(client: AsyncClient, make_professional):
    _, professional = await make_professional()
    res = await client.post(
        "/auth/signup",
        json={
            "name": "Duplicado",
            "email": professional["email"],
            "password": "senha1234",
            "cpf": fake_cpf("dupauthtest"),
        },
    )
    assert res.status_code == 409


async def test_login_with_correct_password_returns_token(client: AsyncClient, make_professional):
    _, professional = await make_professional(password="senha-correta-1")
    res = await client.post(
        "/auth/login", json={"email": professional["email"], "password": "senha-correta-1"}
    )
    assert res.status_code == 200
    assert res.json()["access_token"]


async def test_login_with_wrong_password_is_rejected(client: AsyncClient, make_professional):
    _, professional = await make_professional(password="senha-correta-2")
    res = await client.post(
        "/auth/login", json={"email": professional["email"], "password": "senha-errada"}
    )
    assert res.status_code == 401


async def test_protected_route_without_token_is_rejected(client: AsyncClient):
    res = await client.get("/patients")
    assert res.status_code in (401, 403)


async def test_protected_route_with_garbage_token_is_rejected(client: AsyncClient):
    res = await client.get("/patients", headers=auth_headers("not-a-real-jwt"))
    assert res.status_code == 401
