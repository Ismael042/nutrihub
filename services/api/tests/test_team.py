import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_signup_creates_admin_and_admin_can_invite_member(client: AsyncClient, make_professional):
    token, professional = await make_professional()
    assert professional.get("role") == "admin"
    headers = auth_headers(token)

    invite_res = await client.post(
        "/team/invite",
        json={"name": "Assistente", "email": "assistente.team.test@example.com", "password": "senha1234", "role": "assistant"},
        headers=headers,
    )
    assert invite_res.status_code == 201
    assert invite_res.json()["role"] == "assistant"

    team_res = await client.get("/team", headers=headers)
    assert team_res.status_code == 200
    assert len(team_res.json()) == 2

    login_res = await client.post(
        "/auth/login", json={"email": "assistente.team.test@example.com", "password": "senha1234"}
    )
    assert login_res.status_code == 200
    assert login_res.json()["professional"]["role"] == "assistant"


async def test_non_admin_cannot_invite(client: AsyncClient, make_professional):
    token, _ = await make_professional()
    headers = auth_headers(token)
    invite_res = await client.post(
        "/team/invite",
        json={"name": "Nutri", "email": "nutri.team.test@example.com", "password": "senha1234", "role": "nutritionist"},
        headers=headers,
    )
    assert invite_res.status_code == 201
    nutri_login = await client.post(
        "/auth/login", json={"email": "nutri.team.test@example.com", "password": "senha1234"}
    )
    nutri_headers = auth_headers(nutri_login.json()["access_token"])

    res = await client.post(
        "/team/invite",
        json={"name": "Outro", "email": "outro.team.test@example.com", "password": "senha1234"},
        headers=nutri_headers,
    )
    assert res.status_code == 403


async def test_cannot_remove_last_admin_or_self(client: AsyncClient, make_professional):
    token, professional = await make_professional()
    headers = auth_headers(token)

    self_remove = await client.delete(f"/team/{professional['id']}", headers=headers)
    assert self_remove.status_code == 422

    demote_res = await client.patch(
        f"/team/{professional['id']}", json={"role": "nutritionist"}, headers=headers
    )
    assert demote_res.status_code == 422
