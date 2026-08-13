from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core import db
from app.core.deps import CurrentProfessional, get_current_professional

router = APIRouter(prefix="/notes-tasks", tags=["notes-tasks"])

Kind = Literal["task", "note"]


class NoteTaskCreate(BaseModel):
    kind: Kind
    content: str


class NoteTaskUpdate(BaseModel):
    content: str | None = None
    done: bool | None = None


class NoteTaskOut(BaseModel):
    id: UUID
    kind: str
    content: str
    done: bool


@router.get("", response_model=list[NoteTaskOut])
async def list_notes_tasks(
    current: CurrentProfessional = Depends(get_current_professional),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[NoteTaskOut]:
    async with db.tenant_connection(current.tenant_id) as conn:
        rows = await conn.fetch(
            "select id, kind, content, done from notes_tasks where tenant_id = $1 "
            "order by done, id desc limit $2 offset $3",
            current.tenant_id,
            limit,
            offset,
        )
    return [NoteTaskOut(**dict(row)) for row in rows]


@router.post("", response_model=NoteTaskOut, status_code=201)
async def create_note_task(
    payload: NoteTaskCreate, current: CurrentProfessional = Depends(get_current_professional)
) -> NoteTaskOut:
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            "insert into notes_tasks (tenant_id, kind, content) values ($1, $2, $3) returning id, kind, content, done",
            current.tenant_id,
            payload.kind,
            payload.content,
        )
    return NoteTaskOut(**dict(row))


@router.patch("/{item_id}", response_model=NoteTaskOut)
async def update_note_task(
    item_id: UUID, payload: NoteTaskUpdate, current: CurrentProfessional = Depends(get_current_professional)
) -> NoteTaskOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")
    set_clauses = []
    params: list = [item_id, current.tenant_id]
    for key, value in fields.items():
        params.append(value)
        set_clauses.append(f"{key} = ${len(params)}")
    async with db.tenant_connection(current.tenant_id) as conn:
        row = await conn.fetchrow(
            f"update notes_tasks set {', '.join(set_clauses)} where id = $1 and tenant_id = $2 "
            "returning id, kind, content, done",
            *params,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return NoteTaskOut(**dict(row))


@router.delete("/{item_id}", status_code=204)
async def delete_note_task(item_id: UUID, current: CurrentProfessional = Depends(get_current_professional)) -> None:
    async with db.tenant_connection(current.tenant_id) as conn:
        result = await conn.execute(
            "delete from notes_tasks where id = $1 and tenant_id = $2", item_id, current.tenant_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Item não encontrado")
