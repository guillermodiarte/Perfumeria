import os
import shutil
import zipfile
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from app.dependencies import get_current_admin

router = APIRouter(prefix="/api/admin/backup", tags=["backup"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
if not os.path.exists(UPLOAD_DIR) and os.path.exists(os.path.join(os.getcwd(), "..", "uploads")):
    UPLOAD_DIR = os.path.abspath(os.path.join(os.getcwd(), "..", "uploads"))

DB_PATH = os.path.join(os.getcwd(), "perfumeria.db")
if not os.path.exists(DB_PATH) and os.path.exists(os.path.join(os.getcwd(), "..", "perfumeria.db")):
    DB_PATH = os.path.abspath(os.path.join(os.getcwd(), "..", "perfumeria.db"))

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
                    if file.startswith(".") or file == "__MACOSX":
                        continue
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, UPLOAD_DIR)
                    zipf.write(file_path, arcname)
                    
        import datetime
        timestamp = datetime.date.today().isoformat()
        return FileResponse(
            temp_zip_path, 
            media_type="application/zip", 
            filename=f"multimedia_perfumeria_{timestamp}.zip"
        )
    except Exception as e:
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        raise HTTPException(status_code=500, detail=f"Error al crear el ZIP de imágenes: {str(e)}")

@router.post("/images", dependencies=[Depends(get_current_admin)])
async def import_images(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un .zip")
        
    temp_zip_path = os.path.join(os.getcwd(), "temp_import_images.zip")
    
    try:
        with open(temp_zip_path, "wb+") as f:
            shutil.copyfileobj(file.file, f)
            
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        count = 0
        with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
            infos = zip_ref.infolist()
            valid_files = [
                i for i in infos 
                if not i.is_dir() 
                and not i.filename.startswith("__MACOSX") 
                and not "/__MACOSX/" in i.filename 
                and not os.path.basename(i.filename).startswith(".")
            ]

            if not valid_files:
                raise HTTPException(status_code=400, detail="El archivo ZIP no contiene archivos multimedia válidos")
            
            root_prefix = ""
            first_parts = valid_files[0].filename.split("/")
            if len(first_parts) > 2:
                potential_root = first_parts[0] + "/"
                if all(f.filename.startswith(potential_root) for f in valid_files):
                    root_prefix = potential_root
            elif len(first_parts) == 2:
                candidate = first_parts[0].lower()
                if candidate in ["uploads", "upload", "multimedia", "backup", "imagenes", "images"]:
                    potential_root = first_parts[0] + "/"
                    if all(f.filename.startswith(potential_root) for f in valid_files):
                        root_prefix = potential_root
                        
            for item in valid_files:
                rel_path = item.filename[len(root_prefix):] if root_prefix else item.filename
                rel_path = rel_path.replace("..", "").lstrip("/")
                if not rel_path:
                    continue
                if "/" not in rel_path:
                    rel_path = f"Otros/{rel_path}"
                dest_path = os.path.join(UPLOAD_DIR, rel_path)
                if not os.path.abspath(dest_path).startswith(os.path.abspath(UPLOAD_DIR)):
                    continue
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with zip_ref.open(item) as source, open(dest_path, "wb") as target:
                    shutil.copyfileobj(source, target)
                count += 1
                
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        return {
            "status": "success", 
            "message": f"Se importaron {count} archivo{'s' if count != 1 else ''} correctamente", 
            "importedCount": count
        }
    except HTTPException:
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        raise
    except Exception as e:
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        raise HTTPException(status_code=500, detail=f"Error al restaurar imágenes: {str(e)}")
