FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc \
    pkg-config \
    default-libmysqlclient-dev \
    libssl-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# upgrade toolchain do pip para compilar deps nativas corretamente
RUN python -m pip install --upgrade pip setuptools wheel

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh .
COPY . .
# garantir permissão de execução mesmo após copiar todo o contexto
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000
