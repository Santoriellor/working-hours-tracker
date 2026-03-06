FROM python:3.12-slim
WORKDIR /app
# Copy the whole project structure
COPY app/ ./app/
# requirements are minimal, just install directly
RUN pip install --no-cache-dir fastapi uvicorn aiosqlite
EXPOSE 8000
# Ensure data directory exists
RUN mkdir -p /data
# Volume for persistent data
VOLUME /data
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
