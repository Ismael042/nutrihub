from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional
from app.core.security import create_patient_access_token, hash_password, verify_password

router = APIRouter(tags=["patient-auth"])


class PortalAccessRequest(BaseModel):
    password: str


class PortalAccessResponse(BaseModel):
    patient_id: UUID
    email: str


class PatientLoginRequest(BaseModel):
    email: EmailStr
    password: str


class PatientAuthResponse(BaseModel):
    access_token: str
    patient: dict


@router.post("/patients/{patient_id}/portal-access", response_model=PortalAccessResponse)
async def grant_portal_access(
    patient_id: UUID,
    payload: PortalAccessRequest,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PortalAccessResponse:
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Senha precisa ter pelo menos 8 caracteres")

    password_hash = hash_password(payload.password)
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "select id, email from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        if not row["email"]:
            raise HTTPException(
                status_code=422, detail="Paciente precisa ter um e-mail cadastrado antes de habilitar o portal"
            )
        try:
            await conn.execute("update patients set password_hash = $1 where id = $2", password_hash, patient_id)
        except Exception as exc:  # noqa: BLE001 — unique violation vira 409 legível
            if "unique" in str(exc).lower():
                raise HTTPException(
                    status_code=409, detail="Já existe outro paciente com acesso ao portal usando este e-mail"
                )
            raise
    return PortalAccessResponse(patient_id=patient_id, email=row["email"])


@router.post("/patients/{patient_id}/portal-access/revoke", status_code=204)
async def revoke_portal_access(
    patient_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "update patients set password_hash = null where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Paciente não encontrado")


@router.post("/patient-auth/login", response_model=PatientAuthResponse)
async def patient_login(payload: PatientLoginRequest) -> PatientAuthResponse:
    async with db.pool().acquire() as conn:
        patient = await conn.fetchrow(
            "select id, tenant_id, name, email, password_hash from patients where email = $1",
            payload.email,
        )

    if patient is None or patient["password_hash"] is None or not verify_password(
        payload.password, patient["password_hash"]
    ):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    token = create_patient_access_token(
        patient_id=str(patient["id"]), tenant_id=str(patient["tenant_id"]), email=patient["email"]
    )
    return PatientAuthResponse(
        access_token=token,
        patient={"id": patient["id"], "name": patient["name"], "email": patient["email"]},
    )
