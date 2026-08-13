import pytest
from httpx import AsyncClient

from app.core import db
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_professional_b_cannot_see_professional_a_patients(client: AsyncClient, make_professional):
    token_a, _ = await make_professional()
    token_b, _ = await make_professional()

    create_res = await client.post(
        "/patients", json={"name": "Paciente Secreto de A"}, headers=auth_headers(token_a)
    )
    assert create_res.status_code == 201
    patient_id = create_res.json()["id"]

    list_as_b = await client.get("/patients?status=all", headers=auth_headers(token_b))
    assert not any(p["id"] == patient_id for p in list_as_b.json())

    get_as_b = await client.get(f"/patients/{patient_id}", headers=auth_headers(token_b))
    assert get_as_b.status_code == 404

    delete_as_b = await client.delete(f"/patients/{patient_id}", headers=auth_headers(token_b))
    assert delete_as_b.status_code == 404


async def test_rls_blocks_cross_tenant_even_without_app_filter(client: AsyncClient, make_professional):
    """Prova a segunda camada de defesa: uma query direta na role nutrihub_app,
    escopada via GUC pro tenant B mas SEM `where tenant_id = ...`, não deve enxergar
    o paciente do tenant A. Sem isso, a "segunda camada de defesa" seria só decoração
    — RLS bloquearia por acidente, não porque foi verificado que bloqueia de verdade.
    """
    token_a, professional_a = await make_professional()
    _, professional_b = await make_professional()

    create_res = await client.post(
        "/patients", json={"name": "Paciente Secreto RLS"}, headers=auth_headers(token_a)
    )
    patient_id = create_res.json()["id"]

    async with db.tenant_connection(professional_b["tenant_id"]) as conn:
        rows = await conn.fetch("select id from patients")
    assert not any(str(r["id"]) == patient_id for r in rows)

    async with db.tenant_connection(professional_a["tenant_id"]) as conn:
        rows = await conn.fetch("select id from patients")
    assert any(str(r["id"]) == patient_id for r in rows)
