#!/bin/sh
# ============================================================
# Backup Automático - Base de Datos Perfumería
# Ejecuta periódicamente (ej. diario 00:00 hs vía Cron)
# Retención: 7 días (rolling window)
# ============================================================

# --- Configuration ---
if [ -n "$DATABASE_URL" ]; then
  RAW_PATH=$(echo "$DATABASE_URL" | sed 's/file://')
  if   [ -f "$RAW_PATH" ];                              then DB_PATH="$RAW_PATH"
  elif [ -f "./frontend/prisma/$RAW_PATH" ];            then DB_PATH="./frontend/prisma/$RAW_PATH"
  elif [ -f "./frontend/$RAW_PATH" ];                   then DB_PATH="./frontend/$RAW_PATH"
  elif [ -f "./prisma/$RAW_PATH" ];                     then DB_PATH="./prisma/$RAW_PATH"
  elif [ -f "./prisma/$(basename "$RAW_PATH")" ];       then DB_PATH="./prisma/$(basename "$RAW_PATH")"
  elif [ -f "/app/data/$(basename "$RAW_PATH")" ];      then DB_PATH="/app/data/$(basename "$RAW_PATH")"
  elif [ -f "/app/database/$(basename "$RAW_PATH")" ];  then DB_PATH="/app/database/$(basename "$RAW_PATH")"
  else DB_PATH="$RAW_PATH"
  fi
elif [ -f "/app/data/prod.db" ]; then
  DB_PATH="/app/data/prod.db"
elif [ -f "/app/data/dev.db" ]; then
  DB_PATH="/app/data/dev.db"
elif [ -f "./frontend/prisma/dev.db" ]; then
  DB_PATH="./frontend/prisma/dev.db"
elif [ -f "./prisma/dev.db" ]; then
  DB_PATH="./prisma/dev.db"
else
  # Auto-search any .db file in common volumes
  FOUND_DB=$(find /app/data /app/database ./frontend/prisma ./prisma -maxdepth 2 -name "*.db" ! -name "backup*" ! -name "pre_restore*" 2>/dev/null | head -n 1)
  DB_PATH="${FOUND_DB:-./frontend/prisma/dev.db}"
fi

# Detect backup directory (persist on volume if available)
if [ -z "$BACKUP_DIR" ]; then
  if [ -d "/app/perfumeria_backups" ]; then
    BACKUP_DIR="/app/perfumeria_backups"
  elif [ -d "/app/backups" ]; then
    BACKUP_DIR="/app/backups"
  elif [ -d "/app/data" ]; then
    BACKUP_DIR="/app/data/backups"
  elif [ -d "/app/database" ]; then
    BACKUP_DIR="/app/database/backups"
  else
    BACKUP_DIR="./backups"
  fi
fi

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="backup base de datos global ${TIMESTAMP}.db"

# --- Helpers ---
log() { echo "[backup.sh] $(date '+%Y-%m-%d %H:%M:%S') - $1"; }

# --- Main ---
log "Iniciando backup automático de Perfumería..."
log "Base de datos origen: $DB_PATH"
log "Directorio destino: $BACKUP_DIR"

if ! mkdir -p "$BACKUP_DIR"; then
  log "ERROR: No se pudo crear el directorio $BACKUP_DIR"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  log "ERROR: Archivo de base de datos no encontrado en: $DB_PATH"
  exit 1
fi

DEST_PATH="$BACKUP_DIR/$BACKUP_NAME"

if command -v sqlite3 > /dev/null 2>&1; then
  log "sqlite3 disponible - usando .backup para copia atómica..."
  sqlite3 "$DB_PATH" ".backup '$DEST_PATH'"
else
  log "sqlite3 no disponible - usando cp..."
  cp "$DB_PATH" "$DEST_PATH"
fi

if [ $? -eq 0 ]; then
  log "✅ Backup completado: $DEST_PATH"
else
  log "ERROR: Falló la copia de la base de datos."
  exit 1
fi

# 4. Retention policy: delete backups older than 7 days (preserving pre_restore safety files)
log "Aplicando política de retención (7 días)..."
find "$BACKUP_DIR" -maxdepth 1 -name "backup base de datos global *.db" -mtime +7 | while read OLD_FILE; do
  log "🗑  Eliminando backup antiguo (> 7 días): $OLD_FILE"
  rm -f "$OLD_FILE"
done

log "Backup finalizado correctamente."
ls -lh "$BACKUP_DIR" 2>/dev/null | tail -20
