from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import db
from app.core.config import settings
from app.routers import (
    anthropometry,
    appointments,
    auth,
    booking_requests,
    chat,
    diet_plans,
    financial,
    foods,
    goals,
    health,
    inventory,
    lab_exams,
    locations,
    notes_tasks,
    patient_auth,
    patient_portal,
    patients,
    pharmacies,
    prescriptions,
    public_profile,
    questionnaires,
    recipes,
    recurring_charges,
    substitution_lists,
    tags,
    team,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    yield
    await db.disconnect()


app = FastAPI(title="NutriHub API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(locations.router)
app.include_router(appointments.router)
app.include_router(financial.router)
app.include_router(diet_plans.router)
app.include_router(foods.router)
app.include_router(recipes.router)
app.include_router(tags.router)
app.include_router(goals.router)
app.include_router(questionnaires.router)
app.include_router(lab_exams.router)
app.include_router(substitution_lists.router)
app.include_router(pharmacies.router)
app.include_router(prescriptions.router)
app.include_router(notes_tasks.router)
app.include_router(anthropometry.router)
app.include_router(patient_auth.router)
app.include_router(patient_portal.router)
app.include_router(chat.router)
app.include_router(recurring_charges.router)
app.include_router(inventory.router)
app.include_router(team.router)
app.include_router(public_profile.router)
app.include_router(booking_requests.router)
