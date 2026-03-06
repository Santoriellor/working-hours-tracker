# Working Hours Tracker — Web App Implementation Spec

## Project Overview

Build a self-hosted web application that replicates the functionality of the Working Hours Tracker Excel file. Users can log daily working hours (Mon–Sun), view weekly and monthly summaries, and track a running yearly balance against a 32h/week contract — all from a browser.

The app is containerized with Docker and served behind a Traefik reverse proxy on a VPS.

---

## Feature Requirements

### Core Functionality

- **Year view**: 2026, structured by month (January–December)
- **Weekly grid per month**: rows = weeks, columns = Mon / Tue / Wed / Thu / Fri / Sat / Sun
- **Input**: click a day cell to enter hours worked (decimal, e.g. `7.5` = 7h30)
- **Weekend cells** visually distinct (yellow tint) — optional extra hours
- **Per-week summary**:
  - Total hours worked that week
  - Contract hours for that week (proportional if partial week at month boundary)
  - Balance = worked − contract (green if positive, red if negative, yellow if zero)
- **Per-month summary**: same three values summed across all weeks of the month
- **Yearly summary** (from March 1 onward):
  - One row per month (March → December)
  - Columns: Month | Hours Worked | Contract Hours | Balance
  - Grand total row at the bottom
  - Live — updates as hours are entered

### Contract Parameters

- Contract: **32h/week**, Monday to Friday only
- Daily rate: **6.4h/day** (32 ÷ 5)
- Weekend hours count toward worked total but **not** toward contract target
- Partial weeks (e.g. month starts on Wednesday): contract = working days present × 6.4h

### Data Persistence

- Hours are saved **per user session** in a lightweight backend (SQLite is fine)
- No authentication required (single-user or trusted network use)
- Data survives container restarts

---

## Tech Stack

Keep it simple and minimal:

| Layer | Choice | Reason |
|---|---|---|
| Frontend | **Vanilla HTML + CSS + JS** (no framework) | Zero build step, easy to maintain |
| Backend | **Python + FastAPI** | Lightweight, async, easy REST API |
| Database | **SQLite** via `aiosqlite` | Single file, no extra service |
| Server | **Uvicorn** | ASGI server for FastAPI |
| Reverse proxy | **Traefik v2** | Already on VPS, handles TLS |
| Containerization | **Docker + Docker Compose** | Simple single-service setup |

---

## Project File Structure

```
working-hours-tracker/
├── docker-compose.yml
├── Dockerfile
├── app/
│   ├── main.py          # FastAPI app, routes
│   ├── database.py      # SQLite init + queries
│   ├── models.py        # Pydantic schemas
│   └── static/
│       ├── index.html   # Single-page app
│       ├── style.css
│       └── app.js       # All frontend logic
└── data/                # Mounted volume — holds hours.db
```

---

## API Design

All endpoints are JSON. Base path: `/api`

### Save or update hours for a single day

```
PUT /api/hours
Body: { "date": "2026-03-02", "hours": 7.5 }
Response: { "date": "2026-03-02", "hours": 7.5 }
```

### Get all hours for a month

```
GET /api/hours/{year}/{month}
Response: { "2026-03-02": 7.5, "2026-03-03": 6.0, ... }
```

### Get yearly summary (March onward)

```
GET /api/summary/{year}
Response: [
  { "month": 3, "name": "March", "worked": 142.4, "contract": 139.2, "balance": 3.2 },
  ...
]
```

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS hours (
    date TEXT PRIMARY KEY,   -- ISO format: "2026-03-02"
    hours REAL NOT NULL
);
```

---

## Frontend Behavior

### Layout

- Top navigation: month tabs (Jan–Dec) + a "📊 Yearly" tab
- Active month shows a weekly grid table
- Yearly tab shows the summary table

### Weekly Grid Table

Columns: `Week | Dates | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Total | Contract | +/-`

- Each day cell is an `<input type="number" step="0.5" min="0" max="24">`
- Weekday cells: white background
- Weekend cells (Sat/Sun): light yellow background (`#FFF2CC`)
- Days outside the current month (partial weeks): greyed out, not editable
- On blur/change: auto-save via `PUT /api/hours`
- Week totals and balance recalculate client-side instantly on input

### Color Coding

| Condition | Color |
|---|---|
| Overtime (balance > 0) | Light green `#C6EFCE` |
| Undertime (balance < 0) | Light red `#FFCCCC` |
| Exact (balance = 0) | Light yellow `#FFFFC0` |
| Weekend input cell | Yellow `#FFF2CC` |

### Yearly Summary Table

Columns: `Month | Hours Worked | Contract Hours | Balance`

- Rows: March through December + a **Total** row
- Balance column uses the same green/red/yellow coloring
- Data fetched on tab open from `GET /api/summary/2026`

### Month Loading

- On tab click: fetch `GET /api/hours/2026/{month}`, populate inputs
- Week structure (which days belong to which week) computed entirely client-side using JS `Date` logic

---

## Week Calculation Logic (client-side JS)

```javascript
// Returns array of week objects for a given year/month
function getWeeks(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  let current = new Date(firstDay);
  // rewind to Monday of the first week
  current.setDate(current.getDate() - ((current.getDay() + 6) % 7));

  while (current <= lastDay) {
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(current.getDate() + i);
      weekDays.push({ date: d, inMonth: d.getMonth() === month - 1 });
    }
    if (weekDays.some(d => d.inMonth)) weeks.push(weekDays);
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}
```

---

## Docker Setup

### `Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app/ ./app/
RUN pip install fastapi uvicorn aiosqlite
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  hours-tracker:
    build: .
    container_name: hours-tracker
    restart: unless-stopped
    volumes:
      - ./data:/data          # SQLite DB persisted here
    environment:
      - DB_PATH=/data/hours.db
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.hours.rule=Host(`hours.yourdomain.com`)"
      - "traefik.http.routers.hours.entrypoints=websecure"
      - "traefik.http.routers.hours.tls.certresolver=letsencrypt"
      - "traefik.http.services.hours.loadbalancer.server.port=8000"
    networks:
      - traefik_public          # Must match your existing Traefik network name

networks:
  traefik_public:
    external: true
```

> **Note:** Replace `hours.yourdomain.com` with your actual domain. Replace `traefik_public` with the name of the Docker network your Traefik instance is attached to. Replace `letsencrypt` with your actual Traefik TLS cert resolver name if different.

---

## FastAPI App Skeleton (`app/main.py`)

```python
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

app.mount("/", StaticFiles(directory="app/static", html=True), name="static")
```

---

## Pydantic Model (`app/models.py`)

```python
from pydantic import BaseModel

class HoursEntry(BaseModel):
    date: str   # "2026-03-02"
    hours: float
```

---

## Database Layer (`app/database.py`)

Implement these four async functions using `aiosqlite`:

- `init_db(db_path)` — create the `hours` table if not exists
- `upsert_hours(db_path, date, hours)` — INSERT OR REPLACE
- `get_hours_for_month(db_path, year, month)` — return `{date: hours}` dict for the given month
- `get_yearly_summary(db_path, year)` — for each month March–December, compute:
  - `worked`: sum of all hours in that month
  - `contract`: count of weekdays (Mon–Fri) in that month × 6.4, adjusted for partial first week if month < 3 (start from March 1 for the yearly count)
  - `balance`: worked − contract

> For the yearly summary, contract hours should be computed in Python by iterating over calendar days — do not store contract values in the DB.

---

## Deployment Steps

1. SSH into your VPS
2. Clone/copy the project folder
3. Edit `docker-compose.yml`: set your domain and Traefik network name
4. Run: `docker compose up -d --build`
5. DNS: point `hours.yourdomain.com` A record to your VPS IP
6. Traefik will auto-provision the TLS certificate via Let's Encrypt

---

## Notes for the Implementing AI

- Keep the frontend in a **single `index.html`** file if possible (inline CSS and JS), or split into the three files described above
- All week/contract calculations happen **client-side** — the backend only stores raw daily hours
- The yearly summary contract calculation should happen **server-side** in Python using the `calendar` module
- Use `fetch()` with `debounce` or `onblur` for auto-saving — avoid saving on every keystroke
- No authentication is required; if the VPS is public, consider adding HTTP Basic Auth via a Traefik middleware label
- SQLite is sufficient — do not introduce PostgreSQL or any other database service
- Do not add a frontend framework (React, Vue, etc.) — plain JS is intentional to keep the stack minimal and deployable without a build step
