from typing import Literal
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional, require_admin
from app.core.security import hash_password

router = APIRouter(prefix="/team", tags=["team"])

Role = Literal["admin", "nutritionist", "assistant"]


class InviteRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "nutritionist"


class RoleUpdate(BaseModel):
    role: Role


class MemberOut(BaseModel):
    id: UUID
    name: str
    email: str
    role: str


@router.get("", response_model=list[MemberOut])
async def list_team(current: CurrentProfessional = Depends(get_current_professional)) -> list[MemberOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, name, email, role from professionals where tenant_id = $1 order by role, name",
            current.tenant_id,
        )
    return [MemberOut(**dict(row)) for row in rows]


@router.post("/invite", response_model=MemberOut, status_code=201)
async def invite_member(
    payload: InviteRequest, current: CurrentProfessional = Depends(require_admin)
) -> MemberOut:
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Senha precisa ter pelo menos 8 caracteres")

    password_hash = hash_password(payload.password)
    async with db.tenant_connection(current.tenant_id) as conn:
        # user_id em `professionals` referencia auth.users — usa a conexão de app aqui
        # é seguro porque INSERT em auth.users não tem RLS (ver 0000_local_auth_stub.sql
        # / stub de paridade local; em produção quem é dono de auth.users é o Supabase).
        # email_verified=true direto: quem convida já é um admin autenticado definindo a
        # senha na hora, não um self-signup anônimo — não faz sentido pedir confirmação
        # por e-mail de uma conta que o próprio time acabou de criar.
        try:
            user_id = await conn.fetchval("insert into auth.users (email) values ($1) returning id", payload.email)
            row = await conn.fetchrow(
                """
                insert into professionals (tenant_id, user_id, name, email, password_hash, role, email_verified)
                values ($1, $2, $3, $4, $5, $6, true)
                returning id, name, email, role
                """,
                current.tenant_id,
                user_id,
                payload.name,
                payload.email,
                password_hash,
                payload.role,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="Já existe um profissional com este e-mail")
    return MemberOut(**dict(row))


@router.patch("/{member_id}", response_model=MemberOut)
async def update_member_role(
    member_id: UUID, payload: RoleUpdate, current: CurrentProfessional = Depends(require_admin)
) -> MemberOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        if member_id == current.professional_id and payload.role != "admin":
            other_admins = await conn.fetchval(
                "select count(*) from professionals where tenant_id = $1 and role = 'admin' and id != $2",
                current.tenant_id,
                member_id,
            )
            if other_admins == 0:
                raise HTTPException(
                    status_code=422, detail="Precisa haver pelo menos um administrador no tenant"
                )
        row = await conn.fetchrow(
            "update professionals set role = $1 where id = $2 and tenant_id = $3 returning id, name, email, role",
            payload.role,
            member_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Profissional não encontrado")
    return MemberOut(**dict(row))


@router.delete("/{member_id}", status_code=204)
async def remove_member(member_id: UUID, current: CurrentProfessional = Depends(require_admin)) -> None:
    if member_id == current.professional_id:
        raise HTTPException(status_code=422, detail="Não é possível remover a própria conta")
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from professionals where id = $1 and tenant_id = $2", member_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Profissional não encontrado")
