import os
import shutil
import zipfile
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from app.dependencies import get_current_admin

router = APIRouter(prefix="/api/admin/backup", tags=["backup"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
DB_PATH = os.path.join(os.getcwd(), "perfumeria.db")

@router.get("/db", dependencies=[Depends(get_current_admin)])
def export_db():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="Base de datos no encontrada")
    return FileResponse(DB_PATH, media_type="application/octet-stream", filename="perfumeria_backup.db")

@router.post("/db", dependencies=[Depends(get_current_admin)])
async def import_db(file: UploadFile = File(...)):
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un archivo .db de SQLite")
    
    try:
        with open(DB_PATH, "wb+") as f:
            shutil.copyfileobj(file.file, f)
        return {"status": "success", "message": "Base de datos restaurada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al restaurar la base de datos: {str(e)}")

@router.get("/images", dependencies=[Depends(get_current_admin)])
def export_images():
    if not os.path.exists(UPLOAD_DIR):
        raise HTTPException(status_code=404, detail="Directorio de imágenes no encontrado")
        
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_zip_path = temp_file.name
    temp_file.close()

    try:
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(UPLOAD_DIR):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, UPLOAD_DIR)
                    zipf.write(file_path, arcname)
                    
        return FileResponse(temp_zip_path, media_type="application/zip", filename="imagenes_backup.zip")
    except Exception as e:
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        raise HTTPException(status_code=500, detail=f"Error al crear el ZIP de imágenes: {str(e)}")

@router.post("/images", dependencies=[Depends(get_current_admin)])
async def import_images(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un .zip")
        
    temp_zip_path = os.path.join(os.getcwd(), "temp_import_images.zip")
    
    try:
        with open(temp_zip_path, "wb+") as f:
            shutil.copyfileobj(file.file, f)
            
        # Vaciar carpeta actual de uploads sin borrar el mount point
        if os.path.exists(UPLOAD_DIR):
            for filename in os.listdir(UPLOAD_DIR):
                file_path = os.path.join(UPLOAD_DIR, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    pass
        else:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        # Descomprimir
        with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
            zip_ref.extractall(UPLOAD_DIR)
            
        os.remove(temp_zip_path)
        return {"status": "success", "message": "Imágenes restauradas correctamente"}
    except Exception as e:
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        raise HTTPException(status_code=500, detail=f"Error al restaurar imágenes: {str(e)}")
