import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import init_db, get_hours_for_month, upsert_hours, get_yearly_summary
from app.models import HoursEntry

app = FastAPI()

DB_PATH = os.environ.get("DB_PATH", "./data/hours.db")

@app.on_event("startup")
async def startup():
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    await init_db(DB_PATH)

@app.put("/api/hours")
async def save_hours(entry: HoursEntry):
    await upsert_hours(DB_PATH, entry.date, entry.hours)
    return entry

@app.get("/api/hours/{year}/{month}")
async def get_hours(year: int, month: int):
    return await get_hours_for_month(DB_PATH, year, month)

@app.get("/api/summary/{year}")
async def get_summary(year: int):
    return await get_yearly_summary(DB_PATH, year)

# Mount the static files last
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")
