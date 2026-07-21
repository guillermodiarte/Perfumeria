#!/bin/sh
set -e

echo "Preparando el entorno del Backend de Perfumeria..."

# Forzar zona horaria (opcional, útil para registros)
export TZ="America/Argentina/Buenos_Aires"

# Asegurar que el directorio de la base de datos (persistencia) exista
if [ ! -d "/app/data" ]; then
    echo "Creando directorio /app/data..."
    mkdir -p /app/data
fi

# Asegurar que el directorio de imágenes (persistencia) exista
if [ ! -d "/app/uploads" ]; then
    echo "Creando directorio /app/uploads..."
    mkdir -p /app/uploads
fi

echo "Verificando permisos y estructura..."
# Esto asegura que no falte la carpeta en caso de fallos
mkdir -p /app/uploads/Avatares
mkdir -p /app/uploads/Banners
mkdir -p /app/uploads/Fondos
mkdir -p /app/uploads/Iconos
mkdir -p "/app/uploads/Imágenes"
mkdir -p /app/uploads/Otros
mkdir -p "/app/uploads/Productos/Remeras y Musculosas"
mkdir -p /app/uploads/Videos

# Ejecutar migraciones
echo "Ejecutando migraciones de base de datos..."
# Si la base de datos no existe, alembic se encargará de crear las tablas
alembic upgrade head || echo "Advertencia: Error al ejecutar alembic upgrade head. Revisar si hay un problema en la DB o migraciones."

# Ejecutar scripts de seed para configurar localidades y administradores
echo "Iniciando seeding de localidades y usuarios iniciales..."
if [ -f "seed_locations.py" ]; then
    python seed_locations.py || echo "No se pudo ejecutar seed_locations.py"
fi

if [ -f "seed.py" ]; then
    python seed.py || echo "No se pudo ejecutar seed.py"
fi

echo "¡Todo listo! Iniciando servidor Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
