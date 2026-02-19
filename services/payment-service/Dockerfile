# ── Stage 1: Build dependencies ──────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Add non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy installed packages
COPY --from=builder /install /usr/local

# Copy application
COPY app/ ./app/

ENV PORT=8084
ENV PYTHONUNBUFFERED=1

USER appuser

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8084/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8084"]
