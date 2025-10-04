# Alembic Migrations

This directory stores database migrations for the Finance Tracker backend. Migrations are generated from the SQLModel metadata defined in `apps/api/models`.

## Prerequisites

- Set `DATABASE_URL` to a valid SQLAlchemy connection string (e.g. `postgresql+psycopg2://user:pass@host:5432/dbname`).
- Install dependencies: `pip install -r requirements.txt` (ensure `alembic` is included).

## Common Commands

Generate a new migration:

```bash
alembic revision --autogenerate -m "describe change"
```

Apply migrations locally:

```bash
alembic upgrade head
```

Stamp database without running migrations (useful for legacy imports):

```bash
alembic stamp head
```

To override the database URL without an environment variable:

```bash
alembic -x db-url=postgresql+psycopg2://user:pass@host/db upgrade head
```

The Alembic configuration lives at the repository root (`alembic.ini`) and points to this directory.
