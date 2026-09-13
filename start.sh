#!/bin/sh
set -e

echo "=== Arrancando Aplicación Full-Stack Perfumería ==="
echo "DATABASE_URL: $DATABASE_URL"
echo "UPLOAD_DIR: $UPLOAD_DIR"

# Crear carpetas de persistencia
mkdir -p /app/data
mkdir -p /app/uploads

# Si dev.db fue montado como directorio por error de Docker en el host, advertir y corregir
if [ -d "/app/data/dev.db" ]; then
  echo "AVISO: /app/data/dev.db es un directorio (posible montaje erróneo). Removiendo directorio..."
  rm -rf "/app/data/dev.db"
fi

if [ -d "/app/prisma/dev.db" ]; then
  echo "AVISO: /app/prisma/dev.db es un directorio. Removiendo..."
  rm -rf "/app/prisma/dev.db"
fi

# Inicializar base de datos si no existe en el volumen persistente /app/data/dev.db
if [ ! -f "/app/data/dev.db" ]; then
  echo "No se encontró base de datos en /app/data/dev.db. Inicializando..."
  if [ -f "/app/prisma/dev.db" ]; then
    echo "Copiando base de datos inicial con datos a /app/data/dev.db..."
    cp "/app/prisma/dev.db" "/app/data/dev.db"
  else
    echo "Creando base de datos nueva con migraciones..."
    touch "/app/data/dev.db"
  fi
fi

# Apuntar DATABASE_URL al archivo en el volumen persistente
export DATABASE_URL="file:/app/data/dev.db"

# Ejecutar migraciones de Prisma (seguro incluso si ya están aplicadas)
echo "Aplicando migraciones de Prisma..."
node /app/node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma || echo "ADVERTENCIA: No se pudo ejecutar migrate deploy (continuando de todas formas)"

# Ajustar permisos
chmod -R 777 /app/data 2>/dev/null || true
chmod -R 777 /app/uploads 2>/dev/null || true

echo "Verificando server.js..."
ls -la /app/server.js || echo "ERROR: server.js no encontrado!"
echo ""

echo "Iniciando servidor Next.js en el puerto 3000..."
exec node server.js
