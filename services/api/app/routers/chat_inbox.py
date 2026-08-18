from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core import db, storage
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/chat", tags=["chat"])


class ConversationOut(BaseModel):
    patient_id: UUID
    patient_name: str
    patient_photo_url: str | None
    last_message: str
    last_sender: str
    last_message_at: datetime
    unread_count: int


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(current: CurrentProfessional = Depends(get_current_professional)) -> list[ConversationOut]:
    # distinct on (patient_id) pega só a última mensagem de cada paciente (por causa do
    # order by patient_id, created_at desc); o count de não lidas vem numa correlated
    # subquery separada porque não dá pra combinar com distinct on na mesma linha.
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            """
            select distinct on (m.patient_id)
                m.patient_id,
                p.name as patient_name,
                p.photo_key,
                m.content as last_message,
                m.sender as last_sender,
                m.created_at as last_message_at,
                (
                    select count(*) from chat_messages u
                    where u.patient_id = m.patient_id and u.tenant_id = $1
                    and u.sender = 'patient' and u.read_at is null
                ) as unread_count
            from chat_messages m
            join patients p on p.id = m.patient_id
            where m.tenant_id = $1
            order by m.patient_id, m.created_at desc
            """,
            current.tenant_id,
        )

    conversations = [
        ConversationOut(
            patient_id=row["patient_id"],
            patient_name=row["patient_name"],
            patient_photo_url=storage.presigned_get_url(row["photo_key"]),
            last_message=row["last_message"],
            last_sender=row["last_sender"],
            last_message_at=row["last_message_at"],
            unread_count=row["unread_count"],
        )
        for row in rows
    ]
    conversations.sort(key=lambda c: c.last_message_at, reverse=True)
    return conversations
