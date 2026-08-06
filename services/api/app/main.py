from fastapi import FastAPI

from app.routers import diet_plans, health

app = FastAPI(title="NutriHub API")

app.include_router(health.router)
app.include_router(diet_plans.router)
