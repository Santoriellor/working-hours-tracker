from pydantic import BaseModel

class HoursEntry(BaseModel):
    date: str   # ISO format: "2026-03-02"
    hours: float
