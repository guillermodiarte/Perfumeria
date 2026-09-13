#!/bin/sh
set -e

echo "=== Arrancando Aplicación Full-Stack Perfumería ==="

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
  if [ -f "/app/prisma/dev.db" ]; then
    echo "Copiando base de datos inicial con provincias, ciudades y admins a /app/data/dev.db..."
    cp "/app/prisma/dev.db" "/app/data/dev.db"
  else
    echo "Creando base de datos nueva en /app/data/dev.db..."
    touch "/app/data/dev.db"
  fi
fi

# Mantener sincronizado prisma/dev.db con data/dev.db mediante symlink si es necesario
if [ -f "/app/data/dev.db" ] && [ ! -e "/app/prisma/dev.db" ]; then
  ln -s /app/data/dev.db /app/prisma/dev.db || true
fi

# Ajustar permisos
chmod -R 777 /app/data 2>/dev/null || true
chmod -R 777 /app/uploads 2>/dev/null || true

echo "Iniciando servidor Next.js en el puerto 3000..."
exec node server.js
