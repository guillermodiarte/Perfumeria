# Guía de Despliegue en VPS (Dokploy) - Perfumería

Esta guía detalla los pasos exactos para desplegar el proyecto **Perfumería** (Frontend en Next.js + Backend en FastAPI) en tu servidor VPS de Hostinger utilizando Dokploy (Docker Compose).

El proyecto ya está configurado para que al desplegarse, no pierdas la base de datos ni las imágenes que subas, incluso si reinicias el servidor.

---

## 1. Archivo Docker Compose
En la raíz del proyecto, tienes un archivo `docker-compose.yml` que define ambos servicios (`frontend` y `backend`).

Dokploy utilizará este archivo para construir y ejecutar tu aplicación. 
**Importante:** Hemos configurado la persistencia a través de volúmenes locales. 

## 2. Configuración en Dokploy

1. Inicia sesión en tu panel de Dokploy.
2. Ve a la sección **Applications** o **Compose** y crea una nueva aplicación seleccionando la opción **Docker Compose** (o despliegue mediante un repositorio que tenga el `docker-compose.yml`).
3. Enlaza tu repositorio de GitHub o sube tu código.

### Variables de Entorno (Environment)
Asegúrate de definir estas variables de entorno en la configuración de la aplicación en Dokploy antes de hacer el despliegue:

*Para el Backend (FastAPI):*
- `SQLALCHEMY_DATABASE_URL`: `sqlite:////app/data/perfumeria.db`
- `DOCKER_ENV`: `1`

*Para el Frontend (Next.js):*
- `API_URL_INTERNAL`: `http://backend:8000` *(Para que el servidor de Next se conecte internamente)*
- `NEXT_PUBLIC_API_URL`: `https://api.tudominio.com` *(O la URL pública que asignes a tu backend)*
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: `5493704048860`

### Volúmenes (Persistencia)
Como estamos usando **Docker Compose**, los volúmenes configurados en el archivo `.yml` se generarán automáticamente en el servidor host.

El archivo `docker-compose.yml` especifica:
- `./data:/app/data` (Base de Datos)
- `./uploads:/app/uploads` (Imágenes y Archivos)

**⚠️ IMPORTANTE ANTES DEL PRIMER DESPLIEGUE:**
Si utilizas el modo Compose en Dokploy, usualmente el sistema crea automáticamente las carpetas `data` y `uploads` en el directorio de ejecución. Sin embargo, para evitar cualquier problema de permisos (Error 403 o no poder guardar imágenes), puedes crear manualmente las carpetas en tu servidor y asignarles los permisos correctos en caso de fallos.

### 3. El Script de Inicio Automático
Se ha configurado un script `backend/start.sh` que se ejecutará cada vez que el contenedor del backend se inicie. 

Este script hace todo el trabajo pesado de forma automática:
1. Crea las carpetas `data` y `uploads` (con sus subcarpetas) dentro del contenedor.
2. Ejecuta `alembic upgrade head` para crear y actualizar las tablas de tu base de datos SQLite.
3. Ejecuta `seed_locations.py` para cargar todas las provincias y ciudades de Argentina.
4. Ejecuta `seed.py` para crear los perfiles de **Administrador** por defecto (incluyendo el tuyo y el de Ciara Bonita).
5. Finalmente, arranca la API.

---

## 4. Proceso de Despliegue (Botón Deploy)
Una vez configurado tu proyecto como **Compose** en Dokploy:
1. Haz clic en el botón **Deploy**.
2. Espera a que Dokploy construya las imágenes (esto puede tardar unos minutos porque instalará Python, Node, y compilará la aplicación web).
3. Una vez terminado, verifica los *Logs* del contenedor `backend`. Deberías ver mensajes como:
   `Creando directorio /app/data...`
   `Ejecutando migraciones de base de datos...`
   `Iniciando servidor Uvicorn...`

## 5. Configurar Dominios
En Dokploy, tendrás que configurar dos rutas/dominios para acceder a tu sitio:
1. **Frontend:** Asígnale tu dominio principal (ej: `www.perfumeria.com`) y apúntalo al puerto `3000` de tu servicio `frontend`.
2. **Backend:** Asígnale un subdominio (ej: `api.perfumeria.com`) y apúntalo al puerto `8001` (o el puerto interno `8000`) de tu servicio `backend`.

Recuerda luego ir a tu registrador de dominios (Hostinger) y crear los registros DNS tipo "A" que apunten a la IP pública de tu VPS.

## 🛠️ Solución de Problemas Frecuentes

- **Las imágenes no se guardan o da error 500 al subir foto:**
  Es un problema de permisos en Linux. Conéctate a tu VPS por SSH, ve a la carpeta donde Dokploy guarda los volúmenes del proyecto (generalmente `/etc/dokploy/compose/...`) y ejecuta:
  ```bash
  sudo chmod -R 777 uploads/
  ```

- **La base de datos se reinicia:**
  Asegúrate de que en tu archivo `.env` o en las variables de Dokploy NO exista ninguna ruta local como `./perfumeria.db`, sino exactamente la ruta configurada para el volumen: `sqlite:////app/data/perfumeria.db`.

- **El Frontend no conecta con el Backend:**
  Verifica que `NEXT_PUBLIC_API_URL` apunte a la URL pública real con la que accederás a tu backend (ej: `https://api.perfumeria.com`). Si pones `localhost`, tu teléfono o los clientes no podrán conectarse a la API.
