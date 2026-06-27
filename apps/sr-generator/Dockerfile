FROM python:3.13-slim

# matplotlib/numpy require libgomp1 for OpenMP threading
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies (API extra only)
COPY sr-generator/pyproject.toml sr-generator/uv.lock ./
RUN uv sync --extra api --no-dev --frozen

# Install bptx framework from sibling package
COPY bptx/ ./bptx/
RUN pip install -e ./bptx/

# Application code
COPY sr-generator/src/ ./sr-generator/src/

# Report bundle: template, fonts, all mapping JSON, etc.
COPY sr-generator/data/ ./sr-generator/data/

ENV PYTHONPATH=/app/sr-generator/src

EXPOSE 8321

CMD ["uv", "run", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8321"]
