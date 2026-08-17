from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.core import db, storage
from app.core.cpf import is_valid_cpf, only_digits
from app.core.deps import CurrentProfessional, get_current_professional
from app.core.photos import read_upload, replace_photo

router = APIRouter(prefix="/patients", tags=["patients"])

StatusFilter = Literal["active", "inactive", "all"]

# A lista de colunas aparece nos 4 SQL abaixo; photo_key é traduzida em photo_url
# (assinada) na serialização, ver _out().
COLUMNS = "id, name, email, phone, birth_date, cpf, status, photo_key"


def _out(row) -> "PatientOut":
    data = dict(row)
    # Bucket privado: o banco guarda a chave, a URL é assinada na leitura e expira.
    data["photo_url"] = storage.presigned_get_url(data.pop("photo_key", None))
    return PatientOut(**data)


def _normalize_cpf(cpf: str | None) -> str | None:
    # CPF do paciente é opcional — só valida se algo foi informado, ao contrário do
    # signup do profissional onde é obrigatório (app/routers/auth.py).
    if not cpf:
        return None
    digits = only_digits(cpf)
    if not is_valid_cpf(digits):
        raise HTTPException(status_code=422, detail="CPF inválido")
    return digits


class PatientCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    cpf: str | None = None


class PatientUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    cpf: str | None = None
    status: Literal["active", "inactive"] | None = None
    # photo_key NÃO entra aqui de propósito: o SET do PATCH é montado dinamicamente a
    # partir das chaves deste modelo, então incluí-la deixaria qualquer cliente
    # autenticado apontar a foto pra objeto arbitrário. Foto só muda por
    # POST/DELETE /patients/{id}/photo.


class PatientOut(BaseModel):
    id: UUID
    name: str
    email: str | None
    phone: str | None
    birth_date: date | None
    cpf: str | None
    status: str
    photo_url: str | None = None


class TagOut(BaseModel):
    id: UUID
    name: str


class DiaryEntryOut(BaseModel):
    id: UUID
    logged_at: str
    meal_kind: str | None
    description: str


@router.get("", response_model=list[PatientOut])
async def list_patients(
    current: CurrentProfessional = Depends(get_current_professional),
    status_filter: StatusFilter = Query("active", alias="status"),
    search: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[PatientOut]:
    conditions = ["tenant_id = $1"]
    params: list = [current.tenant_id]

    if status_filter != "all":
        params.append(status_filter)
        conditions.append(f"status = ${len(params)}")

    if search:
        params.append(f"%{search}%")
        conditions.append(f"name ilike ${len(params)}")

    params.extend([limit, offset])
    query = f"""
        select {COLUMNS}
        from patients
        where {' and '.join(conditions)}
        order by name
        limit ${len(params) - 1} offset ${len(params)}
    """

    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)

    return [_out(row) for row in rows]


@router.post("", response_model=PatientOut, status_code=201)
async def create_patient(
    payload: PatientCreate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    cpf = _normalize_cpf(payload.cpf)
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"""
            insert into patients (tenant_id, name, email, phone, birth_date, cpf)
            values ($1, $2, $3, $4, $5, $6)
            returning {COLUMNS}
            """,
            current.tenant_id,
            payload.name,
            payload.email,
            payload.phone,
            payload.birth_date,
            cpf,
        )
    return _out(row)


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"select {COLUMNS} from patients where id = $1 and tenant_id = $2",
            patient_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    return _out(row)


@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    if "cpf" in fields:
        fields["cpf"] = _normalize_cpf(fields["cpf"])

    set_clauses = []
    params: list = [patient_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")

    query = f"""
        update patients set {', '.join(set_clauses)}
        where id = $1 and tenant_id = $2
        returning {COLUMNS}
    """

    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(query, *params)

    if row is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    return _out(row)


@router.post("/{patient_id}/photo", response_model=PatientOut)
async def upload_patient_photo(
    patient_id: UUID,
    file: UploadFile = File(...),
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    raw = await read_upload(file)

    async def swap_key(new_key: str):
        async with db.tenant_connection(current.tenant_id) as conn:
            old_key = await conn.fetchval(
                "select photo_key from patients where id = $1 and tenant_id = $2",
                patient_id,
                current.tenant_id,
            )
            row = await conn.fetchrow(
                f"""
                update patients set photo_key = $3 where id = $1 and tenant_id = $2
                returning {COLUMNS}
                """,
                patient_id,
                current.tenant_id,
                new_key,
            )
        if row is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        return row, old_key

    row = await replace_photo(raw, prefix="patients", owner_id=patient_id, swap_key=swap_key)
    return _out(row)


@router.delete("/{patient_id}/photo", response_model=PatientOut)
async def delete_patient_photo(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> PatientOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        old_key = await conn.fetchval(
            "select photo_key from patients where id = $1 and tenant_id = $2",
            patient_id,
            current.tenant_id,
        )
        row = await conn.fetchrow(
            f"""
            update patients set photo_key = null where id = $1 and tenant_id = $2
            returning {COLUMNS}
            """,
            patient_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")

    await storage.delete_private(old_key)
    return _out(row)


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        # Colhe a chave antes: apagar a linha não apaga o objeto no R2.
        photo_key = await conn.fetchval(
            "select photo_key from patients where id = $1 and tenant_id = $2",
            patient_id,
            current.tenant_id,
        )
        result = await conn.execute(
            "delete from patients where id = $1 and tenant_id = $2",
            patient_id,
            current.tenant_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Paciente não encontrado")

    await storage.delete_private(photo_key)


@router.get("/{patient_id}/tags", response_model=list[TagOut])
async def list_patient_tags(
    patient_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> list[TagOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        rows = await conn.fetch(
            """
            select t.id, t.name from tags t
            join patient_tags pt on pt.tag_id = t.id
            where pt.patient_id = $1
            order by t.name
            """,
            patient_id,
        )
    return [TagOut(**dict(row)) for row in rows]


@router.get("/{patient_id}/diary", response_model=list[DiaryEntryOut])
async def list_patient_diary(
    patient_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[DiaryEntryOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        rows = await conn.fetch(
            """
            select id, logged_at::text, meal_kind, description from food_diary_entries
            where patient_id = $1 and tenant_id = $2
            order by logged_at desc limit $3 offset $4
            """,
            patient_id,
            current.tenant_id,
            limit,
            offset,
        )
    return [DiaryEntryOut(**dict(row)) for row in rows]
