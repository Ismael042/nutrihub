from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.core import db, storage
from app.core.deps import CurrentProfessional, get_current_professional
from app.core.photos import read_attachment, sniff_attachment_type

router = APIRouter(prefix="/lab-exam-requests", tags=["lab-exams"])


class ExamItem(BaseModel):
    name: str


class AttachmentOut(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size_bytes: int
    url: str | None


class LabExamCreate(BaseModel):
    patient_id: UUID
    exams: list[ExamItem]
    notes: str | None = None


class LabExamUpdate(BaseModel):
    exams: list[ExamItem] | None = None
    notes: str | None = None


class LabExamOut(BaseModel):
    id: UUID
    patient_id: UUID
    patient_name: str
    exams: list[dict]
    notes: str | None
    requested_at: date
    attachments: list[AttachmentOut] = []


SELECT = """
    select l.id, l.patient_id, p.name as patient_name, l.exams, l.notes, l.requested_at
    from lab_exam_requests l join patients p on p.id = l.patient_id
"""


async def _attachments_by_request(conn, request_ids: list) -> dict:
    """Carrega os anexos de vários pedidos numa query só (evita N+1 na listagem)."""
    if not request_ids:
        return {}
    rows = await conn.fetch(
        """
        select id, request_id, filename, content_type, size_bytes, storage_key
        from lab_exam_attachments where request_id = any($1::uuid[])
        order by created_at
        """,
        request_ids,
    )
    grouped: dict = {}
    for row in rows:
        grouped.setdefault(row["request_id"], []).append(
            AttachmentOut(
                id=row["id"],
                filename=row["filename"],
                content_type=row["content_type"],
                size_bytes=row["size_bytes"],
                # Bucket privado: URL assinada, expira. Resultado de exame é dado de
                # saúde — não pode ficar acessível por link permanente.
                url=storage.presigned_get_url(row["storage_key"]),
            )
        )
    return grouped


@router.get("", response_model=list[LabExamOut])
async def list_lab_exams(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[LabExamOut]:
    conditions = ["l.tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"l.patient_id = ${len(params)}")
    params.extend([limit, offset])
    query = (
        f"{SELECT} where {' and '.join(conditions)} order by l.requested_at desc "
        f"limit ${len(params) - 1} offset ${len(params)}"
    )
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
        attachments = await _attachments_by_request(conn, [row["id"] for row in rows])
    return [LabExamOut(**dict(row), attachments=attachments.get(row["id"], [])) for row in rows]


@router.post("", response_model=LabExamOut, status_code=201)
async def create_lab_exam(
    payload: LabExamCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> LabExamOut:
    exams = [e.model_dump() for e in payload.exams]
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")
        exam_id = await conn.fetchval(
            "insert into lab_exam_requests (tenant_id, patient_id, exams, notes) values ($1, $2, $3, $4) returning id",
            current.tenant_id,
            payload.patient_id,
            exams,
            payload.notes,
        )
        row = await conn.fetchrow(f"{SELECT} where l.id = $1", exam_id)
    return LabExamOut(**dict(row))


@router.patch("/{exam_id}", response_model=LabExamOut)
async def update_lab_exam(
    exam_id: UUID, payload: LabExamUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> LabExamOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    if "exams" in fields:
        fields["exams"] = [ExamItem(**e).model_dump() for e in fields["exams"]]
    set_clauses = []
    params: list = [exam_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        updated_id = await conn.fetchval(
            f"update lab_exam_requests set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 returning id",
            *params,
        )
        if updated_id is None:
            raise HTTPException(status_code=404, detail="Solicitação não encontrada")
        row = await conn.fetchrow(f"{SELECT} where l.id = $1", updated_id)
        attachments = await _attachments_by_request(conn, [row["id"]])
    return LabExamOut(**dict(row), attachments=attachments.get(row["id"], []))


@router.post("/{exam_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    exam_id: UUID,
    file: UploadFile = File(...),
    current: CurrentProfessional = Depends(get_current_professional),
) -> AttachmentOut:
    raw = await read_attachment(file)
    # Tipo determinado pelos magic bytes, não pelo header do cliente: é com esse tipo
    # que o objeto vai ser servido depois pela URL assinada.
    content_type = sniff_attachment_type(raw, file.content_type)

    async with db.tenant_connection(current.tenant_id) as conn:
        exists = await conn.fetchval(
            "select id from lab_exam_requests where id = $1 and tenant_id = $2", exam_id, current.tenant_id
        )
    if exists is None:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    try:
        key = await storage.put_private("exams", exam_id, raw, content_type=content_type)
    except Exception as exc:  # noqa: BLE001
        print(f"[lab_exams] falha ao subir anexo: {exc}")  # noqa: T201
        raise HTTPException(status_code=502, detail="Não foi possível salvar o arquivo agora. Tente de novo.")

    # O nome original é só rótulo de exibição — a chave do objeto é uuid, então nome
    # com "../" ou caractere estranho não vira caminho em lugar nenhum.
    filename = (file.filename or "arquivo")[:200]

    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            insert into lab_exam_attachments
                (tenant_id, request_id, storage_key, filename, content_type, size_bytes)
            values ($1, $2, $3, $4, $5, $6)
            returning id, filename, content_type, size_bytes, storage_key
            """,
            current.tenant_id,
            exam_id,
            key,
            filename,
            content_type,
            len(raw),
        )
    return AttachmentOut(
        id=row["id"],
        filename=row["filename"],
        content_type=row["content_type"],
        size_bytes=row["size_bytes"],
        url=storage.presigned_get_url(row["storage_key"]),
    )


@router.delete("/{exam_id}/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    exam_id: UUID,
    attachment_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            delete from lab_exam_attachments
            where id = $1 and request_id = $2 and tenant_id = $3
            returning storage_key
            """,
            attachment_id,
            exam_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    await storage.delete_private(row["storage_key"])


@router.delete("/{exam_id}", status_code=204)
async def delete_lab_exam(exam_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        # Anexos somem em cascata no banco, mas os objetos no R2 não.
        keys = [
            r["storage_key"]
            for r in await conn.fetch(
                "select storage_key from lab_exam_attachments where request_id = $1 and tenant_id = $2",
                exam_id,
                current.tenant_id,
            )
        ]
        result = await conn.execute(
            "delete from lab_exam_requests where id = $1 and tenant_id = $2", exam_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    for key in keys:
        await storage.delete_private(key)
