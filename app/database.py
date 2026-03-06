import aiosqlite
import datetime
import calendar
import os

async def init_db(db_path: str):
    async with aiosqlite.connect(db_path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS hours (
                date TEXT PRIMARY KEY,
                hours REAL NOT NULL
            )
        """)
        await db.commit()

async def upsert_hours(db_path: str, date: str, hours: float):
    async with aiosqlite.connect(db_path) as db:
        await db.execute("INSERT OR REPLACE INTO hours (date, hours) VALUES (?, ?)", (date, hours))
        await db.commit()

async def get_hours_for_month(db_path: str, year: int, month: int):
    # month is 1-indexed
    start_date = f"{year}-{month:02d}-01"
    last_day = calendar.monthrange(year, month)[1]
    end_date = f"{year}-{month:02d}-{last_day:02d}"

    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            "SELECT date, hours FROM hours WHERE date >= ? AND date <= ?",
            (start_date, end_date)
        ) as cursor:
            rows = await cursor.fetchall()
            return {row[0]: row[1] for row in rows}

async def get_yearly_summary(db_path: str, year: int):
    # Year summary from March (month 3) to December (month 12)
    # 32h/week contract = 6.4h/day (Mon-Fri)
    results = []
    
    # Get all hours for the year at once to save queries
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            "SELECT date, hours FROM hours WHERE date >= ? AND date <= ?",
            (f"{year}-01-01", f"{year}-12-31")
        ) as cursor:
            all_hours = {row[0]: row[1] for row in await cursor.fetchall()}

    for month in range(3, 13):
        worked = 0.0
        contract = 0.0
        month_name = calendar.month_name[month]
        
        # Calculate contract hours and sum worked hours
        last_day = calendar.monthrange(year, month)[1]
        for day in range(1, last_day + 1):
            date_str = f"{year}-{month:02d}-{day:02d}"
            d = datetime.date(year, month, day)
            
            # Worked hours (if exists in DB)
            worked += all_hours.get(date_str, 0.0)
            
            # Contract hours (Mon-Fri)
            if d.weekday() < 5: # 0-4 is Mon-Fri
                contract += 6.4

        results.append({
            "month": month,
            "name": month_name,
            "worked": round(worked, 2),
            "contract": round(contract, 2),
            "balance": round(worked - contract, 2)
        })
    
    return results
