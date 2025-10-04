# Finance Tracker API

This package hosts the backend code for the Finance Tracker application. The layout is organized so each feature can evolve independently and align with the [data management specification](../../docs/data-management-spec.md).

```
apps/api/
├── shared/         # cross-cutting utilities, mixins, enums
├── models/         # SQLModel table definitions
├── repositories/   # database access patterns and services
├── services/       # domain services, background jobs
├── schemas/        # Pydantic request/response models
├── routes/         # API routers/endpoints
└── README.md
```

Refer to `docs/backend-task-checklist.md` for the implementation roadmap and check off tasks as each area is completed.

## Database Migrations

Alembic is configured at the repository root (`alembic.ini`) with scripts in `apps/api/migrations/`. Set `DATABASE_URL` and run `alembic revision --autogenerate -m "message"` to create migrations, followed by `alembic upgrade head` to apply them.
