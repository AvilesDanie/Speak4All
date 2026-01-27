#!/bin/sh

echo "Waiting for database to be ready..."
sleep 3

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
