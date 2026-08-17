[![Deploy](https://github.com/Santoriellor/working-hours-tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/Santoriellor/working-hours-tracker/actions/workflows/deploy.yml)

# working-hours-tracker

Small FastAPI service for tracking monthly working hours, backed by SQLite.

Live: <https://hours.santoriello.ch>

## Running locally

```bash
pip install -r requirements.txt
DB_PATH=./data/hours.db uvicorn app.main:app --reload
```

## Deployment

Pushing to `main` rsyncs the project to the VPS and rebuilds the container.
`data/` is excluded from the upload — it holds the live SQLite database.

The container runs as uid 1000 to match the host user that owns the bind-mounted `data/`
directory; a mismatch there means the app starts and then fails on its first write.

## Tests

There are none yet.
