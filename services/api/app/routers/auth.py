import asyncpg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.db import pool
from app.core.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    professional: dict


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(payload: SignupRequest) -> AuthResponse:
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Senha precisa ter pelo menos 8 caracteres")

    password_hash = hash_password(payload.password)

    async with pool().acquire() as conn:
        async with conn.transaction():
            try:
                user_id = await conn.fetchval(
                    "insert into auth.users (email) values ($1) returning id",
                    payload.email,
                )
                tenant_id = await conn.fetchval(
                    "insert into tenants (name) values ($1) returning id",
                    f"Consultório de {payload.name}",
                )
                professional = await conn.fetchrow(
                    """
                    insert into professionals (tenant_id, user_id, name, email, password_hash, role)
                    values ($1, $2, $3, $4, $5, 'admin')
                    returning id, tenant_id, name, email, role
                    """,
                    tenant_id,
                    user_id,
                    payload.name,
                    payload.email,
                    password_hash,
                )
            except asyncpg.UniqueViolationError:
                raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    token = create_access_token(
        user_id=str(professional["id"]),
        tenant_id=str(professional["tenant_id"]),
        email=professional["email"],
        role=professional["role"],
    )
    return AuthResponse(access_token=token, professional=dict(professional))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    async with pool().acquire() as conn:
        professional = await conn.fetchrow(
            "select id, tenant_id, name, email, password_hash, role from professionals where email = $1",
            payload.email,
        )

    if professional is None or not verify_password(payload.password, professional["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    token = create_access_token(
        user_id=str(professional["id"]),
        tenant_id=str(professional["tenant_id"]),
        email=professional["email"],
        role=professional["role"],
    )
    return AuthResponse(
        access_token=token,
        professional={
            "id": professional["id"],
            "tenant_id": professional["tenant_id"],
            "name": professional["name"],
            "email": professional["email"],
            "role": professional["role"],
        },
    )
