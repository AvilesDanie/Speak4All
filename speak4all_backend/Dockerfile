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

# Cloud Run suele usar 8080, pero lo importante es usar $PORT
ENV PORT=8080

# (EXPOSE es opcional para Cloud Run, pero no molesta)
EXPOSE 8080

# Importante: usar el puerto que viene en la variable $PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

