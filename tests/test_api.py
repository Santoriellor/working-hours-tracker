"""Smoke tests for the hours-tracker API.

Three things about this app shape the test, all verified against app/main.py:

1. DB_PATH is read at import time (main.py:10), so the environment variable must
   be set before `app` is imported - hence the import order below.
2. The schema is created in an @app.on_event("startup") handler, and TestClient
   only fires startup when used as a context manager. A bare TestClient(app)
   would query a database with no tables.
3. main.py mounts StaticFiles(directory="app/static") with a RELATIVE path at
   import time, so pytest must run from the repository root.
"""
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    # The context manager is what runs the startup handler, which calls init_db.
    with TestClient(app) as c:
        yield c


def test_index_is_served(client):
    """StaticFiles is mounted at / with html=True, so the SPA entry point loads."""
    response = client.get("/")
    assert response.status_code == 200


def test_month_endpoint_returns_a_mapping(client):
    """An empty month returns an empty mapping of date -> hours, not an error.

    get_hours_for_month builds `{row[0]: row[1] for row in rows}`, so the JSON
    body is an object, not an array.
    """
    response = client.get("/api/hours/2026/1")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)


def test_saving_hours_round_trips(client):
    """A PUT is readable back through the month endpoint."""
    assert client.put("/api/hours", json={"date": "2026-01-15", "hours": 7.5}).status_code == 200
    body = client.get("/api/hours/2026/1").json()
    assert body.get("2026-01-15") == 7.5


def test_unknown_route_is_404(client):
    """An unrouted path is a clean 404, not a server error."""
    assert client.get("/no-such-route").status_code == 404
