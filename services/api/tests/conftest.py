import os
import uuid

# Precisa setar antes de importar app.* — Settings() é instanciado no import de
# app.core.config e falha se API_SECRET_KEY não estiver no ambiente (ver
# app/core/config.py, validação adicionada de propósito pra não rodar com default
# inseguro). Testes locais esperam a stack do infra/docker-compose.yml rodando com as
# portas padrão do repo (5432/db, ajuste via env se você expôs em outra porta).
os.environ.setdefault("API_SECRET_KEY", "test-secret-key-for-pytest-only-never-use-in-prod")
os.environ.setdefault("DATABASE_URL", "postgresql://nutrihub:nutrihub@localhost:5432/nutrihub")
os.environ.setdefault(
    "TENANT_DATABASE_URL", "postgresql://nutrihub_app:nutrihub_app_dev_password@localhost:5432/nutrihub"
)

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core import db  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _db_lifecycle():
    # Function-scoped de propósito: pytest-asyncio (strict mode) roda cada teste num
    # event loop novo, e o pool do asyncpg fica preso ao loop em que foi criado —
    # um pool "session-scoped" quebraria com "attached to a different loop" a partir
    # do segundo teste. O custo de abrir/fechar o pool a cada teste é pequeno
    # (min_size=1) e evita esse acoplamento.
    await db.connect()
    yield
    await db.disconnect()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def fake_cpf(seed: str) -> str:
    """Gera 11 dígitos numéricos válidos (dígitos verificadores corretos) a partir de um seed,
    só pra satisfazer o CPF único exigido no signup em teste — não precisa ser um CPF real."""
    from app.core.cpf import _check_digit

    base = "".join(str(ord(c) % 10) for c in seed[:9]).ljust(9, "1")[:9]
    d1 = _check_digit(base, range(10, 1, -1))
    d2 = _check_digit(base + str(d1), range(11, 1, -1))
    return base + str(d1) + str(d2)


@pytest_asyncio.fixture
async def make_professional(client: AsyncClient, monkeypatch):
    """Cria um profissional (+ tenant novo), confirma o e-mail e devolve (token, professional_dict).

    Cada chamada gera um tenant isolado, pra testes de RLS/isolamento poderem criar
    dois tenants distintos sem colidir. Os tenants criados são apagados no teardown.
    """
    created_tenant_ids: list[str] = []
    captured_codes: dict[str, str] = {}

    async def _fake_send(*, to: str, name: str, code: str) -> None:
        captured_codes[to] = code

    monkeypatch.setattr("app.routers.auth.send_verification_email", _fake_send)

    async def _make(name: str | None = None, password: str = "senha1234"):
        suffix = uuid.uuid4().hex[:10]
        name = name or f"QA {suffix}"
        email = f"qa.{suffix}@example.com"
        res = await client.post(
            "/auth/signup",
            json={"name": name, "email": email, "password": password, "cpf": fake_cpf(suffix)},
        )
        assert res.status_code == 201, res.text
        signup_body = res.json()

        code = captured_codes[email]
        verify_res = await client.post(
            "/auth/verify-email", json={"professional_id": signup_body["professional_id"], "code": code}
        )
        assert verify_res.status_code == 200, verify_res.text
        body = verify_res.json()
        created_tenant_ids.append(body["professional"]["tenant_id"])
        return body["access_token"], body["professional"]

    yield _make

    if created_tenant_ids:
        async with db.pool().acquire() as conn:
            await conn.execute("delete from tenants where id = any($1::uuid[])", created_tenant_ids)


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
