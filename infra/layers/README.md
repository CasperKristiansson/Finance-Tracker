# Lambda Layer Build Instructions

This directory builds a single Lambda layer bundle containing the shared Python dependencies required by the Finance Tracker backend. The layer is packaged with:

- alembic 1.16.5
- pydantic 2.11.10
- psycopg2-binary 2.9.10
- requests 2.32.3
- SQLAlchemy 2.0.43
- SQLModel 0.0.25

## Build

```bash
cd infra/layers
make build
```

The command builds the Docker image using the public AWS Lambda Python 3.13 base image, installs the dependencies into the expected Lambda directory structure, and copies the resulting `layer-backend.zip` to the working directory. The archive can then be uploaded as an AWS Lambda layer or referenced in Serverless/Terraform definitions.

## Clean

Remove the generated archive:

```bash
make clean
```

> **Note**: Versions are pinned directly in the Dockerfile to ensure deterministic builds. Update the Dockerfile whenever dependency versions change.
