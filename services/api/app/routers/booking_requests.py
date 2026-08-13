from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/booking-requests", tags=["booking-requests"])

Status = Literal["pending", "approved", "rejected"]


class BookingRequestOut(BaseModel):
    id: UUID
    patient_name: str
    patient_email: str | None
    patient_phone: str | None
    requested_at: datetime
    message: str | None
    status: str


@router.get("", response_model=list[BookingRequestOut])
async def list_booking_requests(
    current: CurrentProfessional = Depends(get_current_professional),
    status_filter: Status | None = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[BookingRequestOut]:
    conditions = ["tenant_id = $1"]
    params: list = [current.tenant_id]
    if status_filter:
        params.append(status_filter)
        conditions.append(f"status = ${len(params)}")
    params.extend([limit, offset])
    query = (
        "select id, patient_name, patient_email, patient_phone, requested_at, message, status "
        f"from booking_requests where {' and '.join(conditions)} order by requested_at "
        f"limit ${len(params) - 1} offset ${len(params)}"
    )
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
    return [BookingRequestOut(**dict(row)) for row in rows]


@router.post("/{request_id}/reject", response_model=BookingRequestOut)
async def reject_booking_request(
    request_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> BookingRequestOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            update booking_requests set status = 'rejected' where id = $1 and tenant_id = $2 and status = 'pending'
            returning id, patient_name, patient_email, patient_phone, requested_at, message, status
            """,
            request_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada ou já processada")
    return BookingRequestOut(**dict(row))


@router.post("/{request_id}/approve", response_model=BookingRequestOut)
async def approve_booking_request(
    request_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> BookingRequestOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        booking = await conn.fetchrow(
            "select * from booking_requests where id = $1 and tenant_id = $2 and status = 'pending'",
            request_id,
            current.tenant_id,
        )
        if booking is None:
            raise HTTPException(status_code=404, detail="Solicitação não encontrada ou já processada")

        patient_id = None
        if booking["patient_email"]:
            patient_id = await conn.fetchval(
                "select id from patients where tenant_id = $1 and email = $2",
                current.tenant_id,
                booking["patient_email"],
            )
        if patient_id is None:
            patient_id = await conn.fetchval(
                """
                insert into patients (tenant_id, name, email, phone)
                values ($1, $2, $3, $4)
                returning id
                """,
                current.tenant_id,
                booking["patient_name"],
                booking["patient_email"],
                booking["patient_phone"],
            )

        await conn.execute(
            "insert into appointments (tenant_id, patient_id, scheduled_at) values ($1, $2, $3)",
            current.tenant_id,
            patient_id,
            booking["requested_at"],
        )

        row = await conn.fetchrow(
            """
            update booking_requests set status = 'approved' where id = $1
            returning id, patient_name, patient_email, patient_phone, requested_at, message, status
            """,
            request_id,
        )
    return BookingRequestOut(**dict(row))
