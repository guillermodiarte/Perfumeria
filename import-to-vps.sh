#!/bin/bash
# ============================================================
# Script para importar datos locales a la VPS via API
# Uso: ./import-to-vps.sh https://TU_DOMINIO_VPS.com
# ============================================================

VPS_URL="${1:-https://perfumeria.tudominio.com}"
EXPORT_FILE="catalog_export.json"

if [ ! -f "$EXPORT_FILE" ]; then
  echo "❌ No se encontró $EXPORT_FILE. Generándolo desde la BD local..."
  sqlite3 "./frontend/prisma/dev.db" "SELECT value FROM site_settings WHERE key = 'catalog_store_data';" > "$EXPORT_FILE"
  if [ ! -s "$EXPORT_FILE" ]; then
    echo "❌ Error: No se pudo exportar la base de datos local."
    exit 1
  fi
fi

echo "📦 Archivo de exportación: $EXPORT_FILE ($(wc -c < "$EXPORT_FILE") bytes)"
echo "🚀 Importando datos a: $VPS_URL/api/store/sync"
echo ""

# Enviar los datos al endpoint de sync de la VPS
HTTP_CODE=$(curl -s -o /tmp/vps_import_response.json -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data "@$EXPORT_FILE" \
  "$VPS_URL/api/store/sync")

echo "📡 Respuesta HTTP: $HTTP_CODE"
echo "📄 Respuesta del servidor:"
cat /tmp/vps_import_response.json
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "✅ ¡Datos importados exitosamente a la VPS!"
  echo "   Recargá la página de la VPS y los productos deberían aparecer."
else
  echo ""
  echo "❌ Error al importar. Código HTTP: $HTTP_CODE"
  echo "   Verificá que la URL sea correcta y que la VPS esté funcionando."
fi
