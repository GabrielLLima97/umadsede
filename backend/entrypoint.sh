#!/usr/bin/env bash
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn core.asgi:application -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 120 --workers 3
