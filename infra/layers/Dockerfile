FROM public.ecr.aws/lambda/python:3.13.2025.05.04.05

WORKDIR /layer

RUN microdnf install -y zip && microdnf clean all

COPY requirements.txt /tmp/requirements.txt

RUN python - <<'PY'
from pathlib import Path
import re

requirements = Path('/tmp/requirements.txt').read_text().splitlines()
keep = {
    'alembic',
    'pydantic',
    'psycopg2-binary',
    'requests',
    'sqlalchemy',
    'sqlmodel',
    'openpyxl',
}
selected = []
for line in requirements:
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    name = re.split(r"[=<>!]", line, 1)[0]
    if name in keep:
        selected.append(line)
Path('/tmp/layer-requirements.txt').write_text('\n'.join(selected))
PY

RUN mkdir -p python/lib/python3.13/site-packages/

RUN python3.13 -m pip install --no-cache-dir -r /tmp/layer-requirements.txt \
    -t python/lib/python3.13/site-packages/

RUN zip -r9 /layer/layer-backend.zip python
