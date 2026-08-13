from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token

bearer_scheme = HTTPBearer()


@dataclass
class CurrentProfessional:
    professional_id: UUID
    tenant_id: UUID
    email: str
    role: str = "admin"


def get_current_professional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentProfessional:
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    # payload.get("kind", "professional"): tokens emitidos antes do login de paciente
    # existir não têm essa claim — tratar ausência como "professional" mantém sessões
    # antigas válidas. Só rejeita quando a claim existe e diz outra coisa (ex: "patient").
    if payload.get("kind", "professional") != "professional":
        raise HTTPException(status_code=401, detail="Token não é de um profissional")

    return CurrentProfessional(
        professional_id=UUID(payload["sub"]),
        tenant_id=UUID(payload["tenant_id"]),
        email=payload["email"],
        # ausente em tokens emitidos antes de multi-profissional existir — tratar como
        # "admin" preserva o comportamento de hoje (o único profissional do tenant).
        role=payload.get("role", "admin"),
    )


def require_admin(current: CurrentProfessional = Depends(get_current_professional)) -> CurrentProfessional:
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Só administradores podem fazer isso")
    return current


@dataclass
class CurrentPatient:
    patient_id: UUID
    tenant_id: UUID
    email: str


def get_current_patient(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentPatient:
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    if payload.get("kind") != "patient":
        raise HTTPException(status_code=401, detail="Token não é de um paciente")

    return CurrentPatient(
        patient_id=UUID(payload["sub"]),
        tenant_id=UUID(payload["tenant_id"]),
        email=payload["email"],
    )
