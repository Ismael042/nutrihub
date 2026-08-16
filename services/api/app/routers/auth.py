import secrets
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx
from fastapi import APIRouter, HTTPException
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.cpf import is_valid_cpf, only_digits
from app.core.db import pool
from app.core.email import send_verification_email
from app.core.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

CODE_TTL = timedelta(minutes=10)
CODE_RESEND_COOLDOWN = timedelta(seconds=60)
CODE_MAX_ATTEMPTS = 5


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    cpf: str


class SignupResponse(BaseModel):
    professional_id: str
    email: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    professional_id: str
    code: str


class ResendCodeRequest(BaseModel):
    professional_id: str


class GoogleAuthRequest(BaseModel):
    id_token: str
    cpf: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    professional: dict


def _validate_cpf(raw: str) -> str:
    digits = only_digits(raw)
    if not is_valid_cpf(digits):
        raise HTTPException(status_code=422, detail="CPF inválido")
    return digits


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def _issue_verification_code(conn: asyncpg.Connection, professional_id, email: str, name: str) -> None:
    code = _generate_code()
    code_hash = hash_password(code)
    expires_at = datetime.now(timezone.utc) + CODE_TTL
    await conn.execute(
        """
        insert into email_verification_codes (professional_id, code_hash, expires_at, attempts, last_sent_at)
        values ($1, $2, $3, 0, now())
        on conflict (professional_id)
        do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at,
                      attempts = 0, last_sent_at = now()
        """,
        professional_id,
        code_hash,
        expires_at,
    )
    try:
        await send_verification_email(to=email, name=name, code=code)
    except httpx.HTTPError as exc:
        # Não derruba o signup por causa de uma falha transitória no provedor de e-mail —
        # a pessoa pode pedir reenvio depois via /auth/resend-code.
        print(f"[auth] falha ao enviar e-mail de verificação para {email}: {exc}")  # noqa: T201


@router.post("/signup", response_model=SignupResponse, status_code=201)
async def signup(payload: SignupRequest) -> SignupResponse:
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Senha precisa ter pelo menos 8 caracteres")

    cpf = _validate_cpf(payload.cpf)
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
                    insert into professionals
                        (tenant_id, user_id, name, email, password_hash, cpf, role, email_verified)
                    values ($1, $2, $3, $4, $5, $6, 'admin', false)
                    returning id, email, name
                    """,
                    tenant_id,
                    user_id,
                    payload.name,
                    payload.email,
                    password_hash,
                    cpf,
                )
            except asyncpg.UniqueViolationError as exc:
                if exc.constraint_name == "professionals_cpf_unique":
                    raise HTTPException(status_code=409, detail="CPF já cadastrado")
                raise HTTPException(status_code=409, detail="E-mail já cadastrado")

        await _issue_verification_code(conn, professional["id"], professional["email"], professional["name"])

    return SignupResponse(professional_id=str(professional["id"]), email=professional["email"])


@router.post("/verify-email", response_model=AuthResponse)
async def verify_email(payload: VerifyEmailRequest) -> AuthResponse:
    async with pool().acquire() as conn:
        professional = await conn.fetchrow(
            "select id, tenant_id, name, email, role, email_verified from professionals where id = $1",
            payload.professional_id,
        )
        if professional is None:
            raise HTTPException(status_code=404, detail="Profissional não encontrado")
        if professional["email_verified"]:
            raise HTTPException(status_code=409, detail="E-mail já verificado")

        verification = await conn.fetchrow(
            "select code_hash, expires_at, attempts from email_verification_codes where professional_id = $1",
            payload.professional_id,
        )
        if verification is None or verification["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Código expirado, solicite um novo")
        if verification["attempts"] >= CODE_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Muitas tentativas incorretas, solicite um novo código")

        if not verify_password(payload.code, verification["code_hash"]):
            await conn.execute(
                "update email_verification_codes set attempts = attempts + 1 where professional_id = $1",
                payload.professional_id,
            )
            raise HTTPException(status_code=401, detail="Código incorreto")

        await conn.execute("update professionals set email_verified = true where id = $1", payload.professional_id)
        await conn.execute(
            "delete from email_verification_codes where professional_id = $1", payload.professional_id
        )

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


@router.post("/resend-code", status_code=204)
async def resend_code(payload: ResendCodeRequest) -> None:
    async with pool().acquire() as conn:
        professional = await conn.fetchrow(
            "select id, name, email, email_verified from professionals where id = $1",
            payload.professional_id,
        )
        if professional is None:
            raise HTTPException(status_code=404, detail="Profissional não encontrado")
        if professional["email_verified"]:
            raise HTTPException(status_code=409, detail="E-mail já verificado")

        verification = await conn.fetchrow(
            "select last_sent_at from email_verification_codes where professional_id = $1",
            payload.professional_id,
        )
        if verification is not None:
            elapsed = datetime.now(timezone.utc) - verification["last_sent_at"]
            if elapsed < CODE_RESEND_COOLDOWN:
                raise HTTPException(status_code=429, detail="Aguarde antes de solicitar outro código")

        await _issue_verification_code(conn, professional["id"], professional["email"], professional["name"])


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    async with pool().acquire() as conn:
        professional = await conn.fetchrow(
            """
            select id, tenant_id, name, email, password_hash, role, email_verified
            from professionals where email = $1
            """,
            payload.email,
        )

    if professional is None:
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    if professional["password_hash"] is None:
        raise HTTPException(status_code=401, detail="Esta conta usa login com Google")
    if not verify_password(payload.password, professional["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    if not professional["email_verified"]:
        raise HTTPException(status_code=403, detail="E-mail não verificado")

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


@router.post("/google", response_model=AuthResponse)
async def google_auth(payload: GoogleAuthRequest) -> AuthResponse:
    try:
        claims = google_id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request(), settings.google_client_id
        )
    except (ValueError, GoogleAuthError):
        raise HTTPException(status_code=401, detail="Token do Google inválido")

    google_sub = claims["sub"]
    email = claims["email"]
    name = claims.get("name") or email

    async with pool().acquire() as conn:
        professional = await conn.fetchrow(
            "select id, tenant_id, name, email, role from professionals where google_id = $1",
            google_sub,
        )
        if professional is None:
            professional = await conn.fetchrow(
                "select id, tenant_id, name, email, role, google_id from professionals where email = $1",
                email,
            )
            if professional is not None and professional["google_id"] is None:
                await conn.execute(
                    "update professionals set google_id = $1 where id = $2", google_sub, professional["id"]
                )

        if professional is None:
            if not payload.cpf:
                raise HTTPException(status_code=422, detail="cpf_required")
            cpf = _validate_cpf(payload.cpf)

            async with conn.transaction():
                try:
                    user_id = await conn.fetchval(
                        "insert into auth.users (email) values ($1) returning id", email
                    )
                    tenant_id = await conn.fetchval(
                        "insert into tenants (name) values ($1) returning id", f"Consultório de {name}"
                    )
                    professional = await conn.fetchrow(
                        """
                        insert into professionals
                            (tenant_id, user_id, name, email, password_hash, cpf, role, google_id, email_verified)
                        values ($1, $2, $3, $4, null, $5, 'admin', $6, true)
                        returning id, tenant_id, name, email, role
                        """,
                        tenant_id,
                        user_id,
                        name,
                        email,
                        cpf,
                        google_sub,
                    )
                except asyncpg.UniqueViolationError as exc:
                    if exc.constraint_name == "professionals_cpf_unique":
                        raise HTTPException(status_code=409, detail="CPF já cadastrado")
                    raise HTTPException(status_code=409, detail="E-mail já cadastrado")

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
