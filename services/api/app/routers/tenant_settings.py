"""Configurações do consultório (tenant), não do profissional individual.

Só existia escrita em `tenants` no signup (auth.py, via db.pool()). Esta é a primeira
rota autenticada a ler/escrever a tabela — o que exigiu a policy de RLS adicionada na
migration 0019, porque `tenants` tinha RLS habilitado sem policy nenhuma e a role
nutrihub_app não conseguia nem ler a própria linha.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core import db, storage
from app.core.deps import CurrentProfessional, get_current_professional, require_admin
from app.core.photos import read_upload, replace_photo

router = APIRouter(prefix="/me/tenant", tags=["tenant-settings"])


class TenantOut(BaseModel):
    id: str
    name: str
    logo_url: str | None = None


def _out(row) -> TenantOut:
    data = dict(row)
    return TenantOut(
        id=str(data["id"]),
        name=data["name"],
        # Bucket privado: o logo só é usado no PDF (gerado no servidor). A URL assinada
        # aqui serve só pro preview na tela de configurações.
        logo_url=storage.presigned_get_url(data.get("logo_key")),
    )


@router.get("", response_model=TenantOut)
async def get_my_tenant(current: CurrentProfessional = Depends(get_current_professional)) -> TenantOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow("select id, name, logo_key from tenants where id = $1", current.tenant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Consultório não encontrado")
    return _out(row)


@router.post("/logo", response_model=TenantOut)
async def upload_logo(
    file: UploadFile = File(...),
    # Logo é do consultório inteiro, não de um profissional — só admin troca.
    current: CurrentProfessional = Depends(require_admin),
) -> TenantOut:
    raw = await read_upload(file)

    async def swap_key(new_key: str):
        async with db.tenant_connection(current.tenant_id) as conn:
            old_key = await conn.fetchval("select logo_key from tenants where id = $1", current.tenant_id)
            row = await conn.fetchrow(
                "update tenants set logo_key = $2 where id = $1 returning id, name, logo_key",
                current.tenant_id,
                new_key,
            )
        if row is None:
            raise HTTPException(status_code=404, detail="Consultório não encontrado")
        return row, old_key

    # as_logo: preserva proporção e transparência (PNG). Logo achatado num branco
    # chapado fica feio no cabeçalho do PDF.
    row = await replace_photo(raw, prefix="logos", owner_id=current.tenant_id, swap_key=swap_key, as_logo=True)
    return _out(row)


@router.delete("/logo", response_model=TenantOut)
async def delete_logo(current: CurrentProfessional = Depends(require_admin)) -> TenantOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        old_key = await conn.fetchval("select logo_key from tenants where id = $1", current.tenant_id)
        row = await conn.fetchrow(
            "update tenants set logo_key = null where id = $1 returning id, name, logo_key",
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Consultório não encontrado")

    await storage.delete_private(old_key)
    return _out(row)
