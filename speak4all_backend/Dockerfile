FROM python:3.11

# Dependencias de sistema (psycopg2, ffmpeg, etc.)
RUN apt-get update && \
    apt-get install -y \
        build-essential \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /code

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Instalar dependencias
COPY requirements.txt .

RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --no-cache-dir -r requirements.txt

# Copiar el código
COPY . .

# Copiar y dar permisos al script de entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Puerto del backend
ENV PORT=8000

EXPOSE 8000

# Usar el script de entrypoint que ejecuta migraciones
ENTRYPOINT ["/entrypoint.sh"]

