from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/patients/{patient_id}/chat", tags=["chat"])


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: UUID
    patient_id: UUID
    sender: str
    content: str
    created_at: datetime


@router.get("", response_model=list[MessageOut])
async def list_messages(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[MessageOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        # Ver a thread = ler a thread: qualquer mensagem do paciente ainda não lida
        # é marcada aqui, antes do select. Isso é o que faz o inbox (/chat/conversations)
        # zerar a contagem de não lidas quando o profissional abre a conversa.
        await conn.execute(
            """
            update chat_messages set read_at = now()
            where patient_id = $1 and tenant_id = $2 and sender = 'patient' and read_at is null
            """,
            patient_id,
            current.tenant_id,
        )
        rows = await conn.fetch(
            """
            select id, patient_id, sender, content, created_at from chat_messages
            where patient_id = $1 and tenant_id = $2
            order by created_at limit $3 offset $4
            """,
            patient_id,
            current.tenant_id,
            limit,
            offset,
        )
    return [MessageOut(**dict(row)) for row in rows]


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    patient_id: UUID,
    payload: MessageCreate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> MessageOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")
        row = await conn.fetchrow(
            """
            insert into chat_messages (tenant_id, patient_id, sender, content)
            values ($1, $2, 'professional', $3)
            returning id, patient_id, sender, content, created_at
            """,
            current.tenant_id,
            patient_id,
            payload.content,
        )
    return MessageOut(**dict(row))
