FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias directamente en la imagen final
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Exponemos el puerto
EXPOSE 8000

# Variables por defecto, Docker Compose las sobreescribirá
ENV SQLALCHEMY_DATABASE_URL="sqlite:////app/data/perfumeria.db"
ENV DOCKER_ENV=1

# Copiar el script de inicio y darle permisos
RUN chmod +x /app/start.sh

# Ejecución por defecto
CMD ["/app/start.sh"]
