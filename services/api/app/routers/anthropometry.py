from datetime import date
from uuid import UUID

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.core import db, storage
from app.core.deps import CurrentProfessional, get_current_professional
from app.core.photos import read_upload

router = APIRouter(prefix="/anthropometric-measurements", tags=["anthropometry"])

PhotoKind = Literal["front", "side", "back"]


class MeasurementPhotoOut(BaseModel):
    id: UUID
    kind: str | None
    url: str | None


class MeasurementCreate(BaseModel):
    patient_id: UUID
    measured_at: date | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    body_fat_pct: float | None = None
    waist_cm: float | None = None
    hip_cm: float | None = None
    neck_cm: float | None = None
    notes: str | None = None


class MeasurementUpdate(BaseModel):
    measured_at: date | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    body_fat_pct: float | None = None
    waist_cm: float | None = None
    hip_cm: float | None = None
    neck_cm: float | None = None
    notes: str | None = None


class MeasurementOut(BaseModel):
    id: UUID
    patient_id: UUID
    measured_at: date
    weight_kg: float | None
    height_cm: float | None
    body_fat_pct: float | None
    waist_cm: float | None
    hip_cm: float | None
    neck_cm: float | None
    notes: str | None
    photos: list[MeasurementPhotoOut] = []


COLUMNS = "id, patient_id, measured_at, weight_kg, height_cm, body_fat_pct, waist_cm, hip_cm, neck_cm, notes"


async def _photos_by_measurement(conn, measurement_ids: list) -> dict:
    """Carrega as fotos de várias medições numa query só (evita N+1 na listagem)."""
    if not measurement_ids:
        return {}
    rows = await conn.fetch(
        """
        select id, measurement_id, kind, storage_key from measurement_photos
        where measurement_id = any($1::uuid[])
        order by created_at
        """,
        measurement_ids,
    )
    grouped: dict = {}
    for row in rows:
        grouped.setdefault(row["measurement_id"], []).append(
            MeasurementPhotoOut(
                id=row["id"],
                kind=row["kind"],
                # Bucket privado: URL assinada, expira. Foto de evolução corporal é
                # dado de saúde, não pode ficar em link permanente.
                url=storage.presigned_get_url(row["storage_key"]),
            )
        )
    return grouped


@router.get("", response_model=list[MeasurementOut])
async def list_measurements(
    current: CurrentProfessional = Depends(get_current_professional),
    patient_id: UUID | None = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[MeasurementOut]:
    conditions = ["tenant_id = $1"]
    params: list = [current.tenant_id]
    if patient_id:
        params.append(patient_id)
        conditions.append(f"patient_id = ${len(params)}")
    params.extend([limit, offset])
    query = (
        f"select {COLUMNS} from anthropometric_measurements where {' and '.join(conditions)} "
        f"order by measured_at limit ${len(params) - 1} offset ${len(params)}"
    )
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(query, *params)
        photos = await _photos_by_measurement(conn, [row["id"] for row in rows])
    return [MeasurementOut(**dict(row), photos=photos.get(row["id"], [])) for row in rows]


@router.post("", response_model=MeasurementOut, status_code=201)
async def create_measurement(
    payload: MeasurementCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> MeasurementOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        patient = await conn.fetchval(
            "select id from patients where id = $1 and tenant_id = $2", payload.patient_id, current.tenant_id
        )
        if patient is None:
            raise HTTPException(status_code=422, detail="Paciente não encontrado")
        row = await conn.fetchrow(
            f"""
            insert into anthropometric_measurements
                (tenant_id, patient_id, measured_at, weight_kg, height_cm, body_fat_pct, waist_cm, hip_cm, neck_cm, notes)
            values ($1, $2, coalesce($3, current_date), $4, $5, $6, $7, $8, $9, $10)
            returning {COLUMNS}
            """,
            current.tenant_id,
            payload.patient_id,
            payload.measured_at,
            payload.weight_kg,
            payload.height_cm,
            payload.body_fat_pct,
            payload.waist_cm,
            payload.hip_cm,
            payload.neck_cm,
            payload.notes,
        )
    return MeasurementOut(**dict(row))


@router.patch("/{measurement_id}", response_model=MeasurementOut)
async def update_measurement(
    measurement_id: UUID,
    payload: MeasurementUpdate,
    current: CurrentProfessional = Depends(get_current_professional),
) -> MeasurementOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [measurement_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"""
            update anthropometric_measurements set {', '.join(set_clauses)}
            where id = $1 and tenant_id = $2
            returning {COLUMNS}
            """,
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Medição não encontrada")
    return MeasurementOut(**dict(row))


@router.post("/{measurement_id}/photos", response_model=MeasurementPhotoOut, status_code=201)
async def upload_measurement_photo(
    measurement_id: UUID,
    file: UploadFile = File(...),
    # Form (não query/JSON): vem no mesmo multipart do arquivo.
    kind: PhotoKind | None = Form(None),
    current: CurrentProfessional = Depends(get_current_professional),
) -> MeasurementPhotoOut:
    raw = await read_upload(file)

    async with db.tenant_connection(current.tenant_id) as conn:
        exists = await conn.fetchval(
            "select id from anthropometric_measurements where id = $1 and tenant_id = $2",
            measurement_id,
            current.tenant_id,
        )
    if exists is None:
        raise HTTPException(status_code=404, detail="Medição não encontrada")

    try:
        normalized = storage.normalize_avatar(raw)
    except storage.InvalidImageError:
        raise HTTPException(status_code=415, detail="Não consegui ler essa imagem. Tente um JPG ou PNG.")

    try:
        key = await storage.put_private("progress", measurement_id, normalized)
    except Exception as exc:  # noqa: BLE001
        print(f"[anthropometry] falha ao subir foto: {exc}")  # noqa: T201
        raise HTTPException(status_code=502, detail="Não foi possível salvar a foto agora. Tente de novo.")

    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            insert into measurement_photos (tenant_id, measurement_id, storage_key, kind)
            values ($1, $2, $3, $4)
            returning id, kind, storage_key
            """,
            current.tenant_id,
            measurement_id,
            key,
            kind,
        )
    return MeasurementPhotoOut(
        id=row["id"], kind=row["kind"], url=storage.presigned_get_url(row["storage_key"])
    )


@router.delete("/{measurement_id}/photos/{photo_id}", status_code=204)
async def delete_measurement_photo(
    measurement_id: UUID,
    photo_id: UUID,
    current: CurrentProfessional = Depends(get_current_professional),
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            """
            delete from measurement_photos
            where id = $1 and measurement_id = $2 and tenant_id = $3
            returning storage_key
            """,
            photo_id,
            measurement_id,
            current.tenant_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    await storage.delete_private(row["storage_key"])


@router.delete("/{measurement_id}", status_code=204)
async def delete_measurement(
    measurement_id: UUID, current: CurrentProfessional = Depends(get_current_professional)
) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        # As fotos somem em cascata no banco, mas os objetos no R2 não — colhe as
        # chaves antes pra não deixar arquivo órfão.
        keys = [
            r["storage_key"]
            for r in await conn.fetch(
                "select storage_key from measurement_photos where measurement_id = $1 and tenant_id = $2",
                measurement_id,
                current.tenant_id,
            )
        ]
        result = await conn.execute(
            "delete from anthropometric_measurements where id = $1 and tenant_id = $2",
            measurement_id,
            current.tenant_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Medição não encontrada")

    for key in keys:
        await storage.delete_private(key)
