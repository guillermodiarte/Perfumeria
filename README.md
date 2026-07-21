# Essence Perfumería SaaS Boilerplate

Bienvenido a la versión final de **Essence Perfumería**, expandida con base de datos reactiva y panel de administrador completo.

## Arquitectura Extendida
- **Frontend**: Next.js 14, TailwindCSS. Componente Admin interconectado con estado React.
- **Backend**: FastAPI, SQLite. Endpoint de carga de imágenes (UploadFile) y CRUD de productos listos.
- **Persistencia en VPS Dokploy**: Volúmenes `./uploads` y `./data` completamente independientes del ciclo de vida del contenedor.

---

## 🚀 Método 1: Ejecución con Docker (Recomendado)
Si tienes Docker Desktop iniciado en tu máquina, abre una terminal en esta misma carpeta y ejecuta:
```bash
docker compose up --build
```
*Si tienes error de que el demonio no está corriendo, abre la aplicación "Docker Desktop" en tu Mac primero.*

---

## ⚡ Método 2: Ejecución Nativa (Sin Docker)
Al igual que en tu proyecto anterior (Chimucheck), he preparado el proyecto para que levantes todo el sistema con un solo comando usando `concurrently`. 

Además, he movido el Backend al puerto **8001** para evitar conflictos con el proyecto Gym SaaS CRM (o cualquier otro) que ya esté corriendo en el 8000.

Desde la carpeta raíz del proyecto, abre tu terminal y ejecuta:

### 1. Instalación Inicial (Sólo la primera vez)
```bash
npm run setup
```

### 2. Ejecutar el Sistema
```bash
npm run dev
```

Esto arrancará mágicamente en simultáneo tu Frontend en `http://localhost:3000` y tu Backend en la IP interna `http://localhost:8001`.

---

## 🧪 Pruebas a realizar:
1. **Catálogo Público**: Visita [http://localhost:3000/catalog](http://localhost:3000/catalog)
2. **Dashboard de Admin**: Visita [http://localhost:3000/admin](http://localhost:3000/admin)
   - *Pro Tip*: Ingresa con la clave `Gad33224122`.
   - Podrás ver el inventario desde SQLite.
   - Presiona "Nuevo Producto", llena los datos y sube una foto desde tu Mac. Al guardar, verás que la imagen se guarda mágicamente en la carpeta `/uploads` del proyecto y el producto aparece en el Frontend inmediatamente.
