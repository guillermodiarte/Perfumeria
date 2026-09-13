# Guía de Despliegue en VPS (Dokploy) - Perfumería (Full-Stack Unificado)

Esta guía detalla los pasos para desplegar el proyecto **Perfumería** completamente unificado en **Next.js** (igual que en **CRM Alojamientos Temporarios**).

Ahora **no necesitas ejecutar Python ni Uvicorn en un contenedor o puerto separado**. Todo el sistema (Frontend + API Backend + Base de Datos SQLite con Prisma + Subida de Imágenes) corre como **un único servicio en el puerto 3000 con un solo dominio**.

---

## 1. Características del Sistema Unificado

- **Framework:** Next.js (App Router con Route Handlers nativos en `src/app/api/`).
- **Base de Datos:** SQLite gestionada a través de **Prisma ORM**.
- **Puerto de Ejecución:** `3000`.
- **Dominio Único:** Un solo dominio (ej: `perfumeria.tudominio.com`), sin necesidad de configurar subdominios para la API ni lidiar con CORS.
- **Persistencia:** Volúmenes para SQLite (`./frontend/prisma/dev.db`) y para imágenes (`./uploads`).

---

## 2. Configuración en Dokploy

1. Inicia sesión en tu panel de **Dokploy**.
2. Ve a **Applications** y haz clic en **Create Application**.
3. Selecciona el origen de tu código (**GitHub** o **Git**).
4. Elige el tipo de construcción: **Nixpacks** o **Dockerfile** de Next.js.
5. Si el proyecto tiene subcarpeta, establece el Base Directory en `frontend` o ejecuta desde la raíz con los scripts de npm.

### Variables de Entorno (Environment) en Dokploy

Configura las siguientes variables en la pestaña **Environment**:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/app/frontend/prisma/dev.db
JWT_SECRET=super-secret-lyg-token-998877
UPLOAD_DIR=/app/uploads
```

### Volúmenes Persistentes (Mounts / Storage)

Para que los datos de la base de datos y las imágenes no se borren en cada actualización:
1. Ve a la pestaña **Mounts / Volumes** de tu aplicación en Dokploy.
2. Agrega los siguientes montajes de volumen tipo *Bind* o *Volume*:
   - **Base de datos:**
     - Host Path: `/etc/dokploy/volumes/perfumeria/data/dev.db`
     - Mount Path: `/app/frontend/prisma/dev.db`
   - **Imágenes y Archivos:**
     - Host Path: `/etc/dokploy/volumes/perfumeria/uploads`
     - Mount Path: `/app/uploads`

---

## 3. Configuración de Dominio

1. En la pestaña **Domains** de Dokploy:
   - Agrega tu dominio (ej: `perfumeria.tudominio.com`).
   - Apúntalo al **Puerto 3000**.
   - Habilita el certificado **SSL / HTTPS** (Let's Encrypt automático).

2. En tu proveedor de DNS (Hostinger, Cloudflare, etc.):
   - Crea un registro tipo `A` que apunte tu dominio a la IP pública de tu VPS.

---

## 4. Comandos Locales Útiles

Para trabajar en tu máquina local:

- **Iniciar la aplicación:**
  ```bash
  npm run dev
  ```
  *(Abre directamente en http://localhost:3000 con todo el backend integrado)*

- **Compilar para producción:**
  ```bash
  npm run build
  ```

- **Explorar la base de datos visualmente:**
  ```bash
  npm run prisma:studio
  ```
