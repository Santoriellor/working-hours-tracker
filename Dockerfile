FROM python:3.12-slim
WORKDIR /app

# Install pinned dependencies before copying source, so a source-only change
# does not invalidate the dependency layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# Run as an unprivileged account. uid 1000 deliberately matches `santo` on the
# VPS: /data is a host bind mount (./data:/data), so the container uid must be
# able to write to a host directory. A mismatch here means the app starts and
# then fails on the first database write.
RUN groupadd --gid 1000 app \
    && useradd --uid 1000 --gid 1000 --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /data \
    && chown -R 1000:1000 /data /app

USER 1000:1000

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
