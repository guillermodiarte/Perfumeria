import os
import shutil
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app.models import Base, Customer, Admin, SiteSetting, Province, City, CartItem, Order, OrderItem
from app.schemas import CustomerCreateSchema, CustomerSchema, CustomerUpdateSchema, AdminSchema, AdminCreateSchema, LoginSchema, Token, SiteSettingSchema, SiteSettingUpdateSchema, MediaMoveSchema, ProvinceSchema, CitySchema
from app.auth import get_password_hash, create_access_token
import uuid

# Database Setup
from app.dependencies import engine, SessionLocal, get_db, get_current_admin

# Asegurar carpeta de uploads persistente
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Categorias por defecto para la biblioteca
DEFAULT_MEDIA_CATEGORIES = ["Imágenes", "Fondos", "Avatares", "Videos", "Otros"]
for cat in DEFAULT_MEDIA_CATEGORIES:
    os.makedirs(os.path.join(UPLOAD_DIR, cat), exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Essence Perfumería API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En prod, poner la URL real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servimos archivos persistentes configurado arriba
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Import routers
from app.routers import customer_auth, admin_auth, locations, orders, backup

app.include_router(customer_auth.router)
app.include_router(admin_auth.router)
app.include_router(locations.router)
app.include_router(orders.router)
app.include_router(backup.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"message": "API Perfumeria Online - Backend Activo"}



# --- ADMIN ENDPOINTS ---

@app.post("/api/admin/upload", dependencies=[Depends(get_current_admin)])
async def upload_image(request: Request, file: UploadFile = File(...)):
    try:
        # Default upload going to "Otros"
        category_dir = os.path.join(UPLOAD_DIR, "Otros")
        os.makedirs(category_dir, exist_ok=True)
        file_location = os.path.join(category_dir, file.filename)
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        host_url = str(request.base_url).rstrip("/")
        image_url = f"{host_url}/uploads/Otros/{file.filename}"
        return {"url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/media", dependencies=[Depends(get_current_admin)])
def get_media_library(request: Request, category: str = None):
    try:
        host_url = str(request.base_url).rstrip("/")
        media_files = []
        categories = []

        for entry in os.scandir(UPLOAD_DIR):
            if not entry.is_dir():
                continue
            cat_name = entry.name
            # Check if it has subdirectories (e.g., productos/Remeras)
            has_subdirs = any(e.is_dir() for e in os.scandir(entry.path))
            if has_subdirs:
                # Recurse one level
                for sub in os.scandir(entry.path):
                    if not sub.is_dir():
                        continue
                    sub_cat = f"{cat_name}/{sub.name}"
                    if not category or category == sub_cat or category == cat_name:
                        categories.append(sub_cat)
                        for f in os.scandir(sub.path):
                            if f.is_file():
                                size_kb = os.path.getsize(f.path) / 1024
                                media_files.append({
                                    "filename": f.name,
                                    "category": sub_cat,
                                    "url": f"{host_url}/uploads/{cat_name}/{sub.name}/{f.name}",
                                    "size": f"{size_kb:.2f} KB"
                                })
            else:
                if not category or category == cat_name:
                    categories.append(cat_name)
                    for f in os.scandir(entry.path):
                        if f.is_file():
                            size_kb = os.path.getsize(f.path) / 1024
                            media_files.append({
                                "filename": f.name,
                                "category": cat_name,
                                "url": f"{host_url}/uploads/{cat_name}/{f.name}",
                                "size": f"{size_kb:.2f} KB"
                            })

        if category:
            categories = [c for c in categories if c == category]
        else:
            categories = sorted(list(set(categories)))

        return {"categories": categories, "files": media_files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/media", dependencies=[Depends(get_current_admin)])
async def upload_media_file(request: Request, file: UploadFile = File(...), category: str = "Otros"):
    try:
        # Asegurarse que la categoría exista
        safe_category = category.strip().replace("..", "").replace("/", "")
        if not safe_category:
            safe_category = "Otros"
            
        category_dir = os.path.join(UPLOAD_DIR, safe_category)
        os.makedirs(category_dir, exist_ok=True)
        
        file_location = os.path.join(category_dir, file.filename)
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        host_url = str(request.base_url).rstrip("/")
        image_url = f"{host_url}/uploads/{safe_category}/{file.filename}"
        
        size_kb = os.path.getsize(file_location) / 1024
        
        return {
            "filename": file.filename,
            "category": safe_category,
            "url": image_url,
            "size": f"{size_kb:.2f} KB"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Dedicated endpoint for product images → uploads/productos/{subcategory}/ ---
@app.post("/api/admin/product-image", dependencies=[Depends(get_current_admin)])
async def upload_product_image(request: Request, file: UploadFile = File(...), subcategory: str = "General"):
    """Upload a product image to uploads/productos/{subcategory}.
    The subcategory should be the product's categoryId, e.g. 'Remeras y Musculosas'."""
    try:
        # Sanitize: strip path traversal but ALLOW spaces and letters
        safe_sub = subcategory.strip().replace("..", "").replace("/", "").replace("\\", "")
        if not safe_sub:
            safe_sub = "General"

        dest_dir = os.path.join(UPLOAD_DIR, "productos", safe_sub)
        os.makedirs(dest_dir, exist_ok=True)

        # Avoid filename collisions with a short timestamp prefix
        import time
        ts = str(int(time.time() * 1000))[-6:]
        safe_name = f"{ts}_{file.filename}"
        file_location = os.path.join(dest_dir, safe_name)

        with open(file_location, "wb+") as fo:
            shutil.copyfileobj(file.file, fo)

        host_url = str(request.base_url).rstrip("/")
        image_url = f"{host_url}/uploads/productos/{safe_sub}/{safe_name}"
        size_kb = os.path.getsize(file_location) / 1024

        return {
            "filename": safe_name,
            "category": f"productos/{safe_sub}",
            "url": image_url,
            "size": f"{size_kb:.2f} KB"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/media", dependencies=[Depends(get_current_admin)])
def delete_media_file(category: str, filename: str):
    try:
        safe_category = category.strip().replace("..", "")
        safe_filename = filename.strip().replace("..", "").replace("/", "")
        file_path = os.path.join(UPLOAD_DIR, safe_category, safe_filename)
        
        if os.path.exists(file_path) and os.path.isfile(file_path):
            os.remove(file_path)
            return {"status": "success", "message": "File deleted"}
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except HTTPException:
        raise
@app.put("/api/admin/media/move", dependencies=[Depends(get_current_admin)])
def move_media_file(category: str, filename: str, data: MediaMoveSchema):
    try:
        new_category = data.new_category.strip().replace("..", "")
        safe_category = category.strip().replace("..", "")
        safe_filename = filename.strip().replace("..", "").replace("/", "")
        
        old_path = os.path.join(UPLOAD_DIR, safe_category, safe_filename)
        new_dir = os.path.join(UPLOAD_DIR, new_category)
        new_path = os.path.join(new_dir, safe_filename)
        
        if not os.path.exists(old_path) or not os.path.isfile(old_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        os.makedirs(new_dir, exist_ok=True)
        shutil.move(old_path, new_path)
        
        return {"status": "success", "message": "File moved"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# --- AUTH & USER ENDPOINTS --- (Legacy admin login used by the admin panel)

@app.post("/api/admin/login", response_model=Token)
def login_admin_legacy(user_cred: LoginSchema, db: Session = Depends(get_db)):
    from app.auth import verify_password
    admin = db.query(Admin).filter(Admin.email == user_cred.email).first()
    if not admin or not verify_password(user_cred.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    access_token = create_access_token(data={"sub": admin.email, "role": admin.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/admin/users", response_model=list[CustomerSchema], dependencies=[Depends(get_current_admin)])
def get_users(db: Session = Depends(get_db)):
    return db.query(Customer).all()

@app.post("/api/admin/users", response_model=CustomerSchema, dependencies=[Depends(get_current_admin)])
def create_admin_user(data: CustomerCreateSchema, db: Session = Depends(get_db)):
    exist = db.query(Customer).filter(Customer.email == data.email).first()
    if exist:
        raise HTTPException(status_code=400, detail="Este correo ya esta registrado")
        
    pwd_hash = get_password_hash(data.password)
    new_user = Customer(email=data.email, name=data.name, phone=data.phone,
                        password_hash=pwd_hash, email_verified=True)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.put("/api/admin/users/{user_id}", response_model=CustomerSchema, dependencies=[Depends(get_current_admin)])
def update_admin_user(user_id: int, data: CustomerUpdateSchema, db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    user = db.query(Customer).filter(Customer.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if data.email:
        exist = db.query(Customer).filter(Customer.email == data.email, Customer.id != user_id).first()
        if exist:
            raise HTTPException(status_code=400, detail="Este correo ya esta en uso por otro usuario")
        user.email = data.email
    if data.name is not None:
        user.name = data.name
    if data.phone is not None:
        user.phone = data.phone
    if data.password:
        user.password_hash = get_password_hash(data.password)
        
    db.commit()
    db.refresh(user)
    return user

@app.delete("/api/admin/users/{user_id}", dependencies=[Depends(get_current_admin)])
def delete_admin_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(Customer).filter(Customer.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

# --- Endpoints para Secciones del Sitio (Key-Value Configs) ---

@app.get("/api/settings", response_model=list[SiteSettingSchema])
def get_public_settings(db: Session = Depends(get_db)):
    """Devuelve todas las configuraciones públicas activas"""
    return db.query(SiteSetting).all()

@app.get("/api/settings/{key}", response_model=SiteSettingSchema)
def get_public_setting_by_key(key: str, db: Session = Depends(get_db)):
    """Devuelve una configuración específica por su key"""
    setting = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return setting

@app.put("/api/admin/settings/{key}", response_model=SiteSettingSchema)
def update_site_setting(key: str, data: SiteSettingUpdateSchema, db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    """
    Actualiza (o crea si no existe) una configuración de sección.
    El campo 'value' admite cualquier estructura JSON válida.
    """
    setting = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    if not setting:
        setting = SiteSetting(key=key, value=data.value)
        db.add(setting)
    else:
        setting.value = data.value
    
    db.commit()
    db.refresh(setting)
    return setting
