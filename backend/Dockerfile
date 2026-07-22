# Multi-stage Dockerfile para FastAPI (Backend)
FROM python:3.11-slim as builder

WORKDIR /app
# Preparamos las dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim

WORKDIR /app

# Copiar dependencias de Python del builder (Para entornos más complejos usamos wheels)
# En este caso instalamos directamente en producción para mantener el archivo simple y directo
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

COPY . .

# Exponemos el puerto
EXPOSE 8000

# Variables por defecto, Docker Compose las sobreescribirá
ENV SQLALCHEMY_DATABASE_URL="sqlite:////app/data/perfumeria.db"
ENV DOCKER_ENV=1

# Copiar el script de inicio y darle permisos
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Ejecución por defecto
CMD ["/app/start.sh"]
