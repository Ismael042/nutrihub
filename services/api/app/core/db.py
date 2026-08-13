import json
from contextlib import asynccontextmanager
from typing import AsyncIterator
from uuid import UUID

import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None
_tenant_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    for pg_type in ("json", "jsonb"):
        await conn.set_type_codec(
            pg_type,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
            format="text",
        )


async def connect() -> None:
    global _pool, _tenant_pool
    _pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=5, init=_init_connection)
    _tenant_pool = await asyncpg.create_pool(
        settings.tenant_database_url, min_size=1, max_size=10, init=_init_connection
    )


async def disconnect() -> None:
    if _pool is not None:
        await _pool.close()
    if _tenant_pool is not None:
        await _tenant_pool.close()


def pool() -> asyncpg.Pool:
    # Dono das tabelas — bypassa RLS incondicionalmente. Só app/routers/auth.py deve
    # usar isso (signup/login precisam olhar entre tenants antes de existir sessão).
    if _pool is None:
        raise RuntimeError("DB pool not initialized")
    return _pool


@asynccontextmanager
async def tenant_connection(tenant_id: UUID) -> AsyncIterator[asyncpg.Connection]:
    # Toda rota autenticada usa isto, nunca pool(). Seta a GUC de sessão que
    # current_tenant_ids() lê (ver 0003_app_role_rls.sql) e sempre reseta antes de
    # devolver a conexão ao pool — sem isso, o tenant de uma request vazaria pra
    # próxima que reusar a mesma conexão física.
    if _tenant_pool is None:
        raise RuntimeError("Tenant DB pool not initialized")
    async with _tenant_pool.acquire() as conn:
        await conn.execute("select set_config('app.current_tenant_id', $1, false)", str(tenant_id))
        try:
            yield conn
        finally:
            await conn.execute("select set_config('app.current_tenant_id', '', false)")
