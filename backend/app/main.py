import os
import shutil
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app.models import Base, Customer, Admin, SiteSetting, Province, City, CartItem, Order, OrderItem, Supplier, PurchaseBatch, PurchaseBatchItem
from app.schemas import (CustomerCreateSchema, CustomerSchema, CustomerUpdateSchema, CustomerApprovalUpdateSchema,
    CustomerWholesaleUpdateSchema, AdminSchema, AdminCreateSchema, LoginSchema, Token, SiteSettingSchema,
    SiteSettingUpdateSchema, MediaMoveSchema, ProvinceSchema, CitySchema,
    SupplierCreateSchema, SupplierSchema, PurchaseBatchCreateSchema, PurchaseBatchSchema)
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

# Asegurar columnas añadidas dinámicamente en SQLite
def _ensure_sqlite_columns():
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # customers table columns
            res_cust = conn.execute(text("PRAGMA table_info(customers)")).fetchall()
            cols_cust = [r[1] for r in res_cust]
            if "is_wholesale" not in cols_cust:
                conn.execute(text("ALTER TABLE customers ADD COLUMN is_wholesale BOOLEAN DEFAULT 0"))
            if "wholesale_until" not in cols_cust:
                conn.execute(text("ALTER TABLE customers ADD COLUMN wholesale_until DATETIME"))

            # orders table columns
            res = conn.execute(text("PRAGMA table_info(orders)")).fetchall()
            cols = [r[1] for r in res]
            if "payment_status" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN payment_status VARCHAR DEFAULT 'pending'"))
            if "payment_type" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN payment_type VARCHAR DEFAULT 'total'"))
            if "installments_count" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN installments_count INTEGER DEFAULT 1"))
            if "last_installment_paid_month" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN last_installment_paid_month VARCHAR"))
            if "delivery_status" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delivery_status VARCHAR DEFAULT 'pending'"))
            if "paid_amount" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN paid_amount NUMERIC(10, 2) DEFAULT 0.0"))
            if "admin_notes" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN admin_notes VARCHAR"))
            if "shipping_type" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN shipping_type VARCHAR DEFAULT 'delivery'"))
            if "shipping_cost" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN shipping_cost NUMERIC(10, 2) DEFAULT 0"))
            if "shipping_tracking_number" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN shipping_tracking_number VARCHAR"))
            if "shipping_invoice_url" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN shipping_invoice_url VARCHAR"))
            if "shipped_at" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN shipped_at VARCHAR"))

            # order_items table columns
            res_items = conn.execute(text("PRAGMA table_info(order_items)")).fetchall()
            cols_items = [r[1] for r in res_items]
            if "product_name" not in cols_items:
                conn.execute(text("ALTER TABLE order_items ADD COLUMN product_name VARCHAR"))
            if "variant_info" not in cols_items:
                conn.execute(text("ALTER TABLE order_items ADD COLUMN variant_info VARCHAR"))
            if "image_url" not in cols_items:
                conn.execute(text("ALTER TABLE order_items ADD COLUMN image_url VARCHAR"))

            # purchase_batches table columns (migración dinámica para SQLite)
            res_pb = conn.execute(text("PRAGMA table_info(purchase_batches)")).fetchall()
            cols_pb = [r[1] for r in res_pb]
            if not cols_pb:
                # Tabla no existe todavía → la creará Base.metadata.create_all arriba
                pass
            else:
                if "total_products_ars" not in cols_pb:
                    conn.execute(text("ALTER TABLE purchase_batches ADD COLUMN total_products_ars FLOAT DEFAULT 0"))

            conn.commit()
    except Exception as err:
        print("SQLite column check notice:", err)

_ensure_sqlite_columns()

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
        categories_set = set(["Avatares", "Banners", "BodySpray", "Fondos", "Iconos", "Imágenes", "Labiales", "Logo", "Otros", "Perfumes"])
        seen_rel = set()

        # Collect candidate upload folders
        candidate_dirs = [
            UPLOAD_DIR,
            os.path.abspath(os.path.join(os.getcwd(), "..", "uploads")),
            os.path.abspath(os.path.join(os.getcwd(), "frontend", "public", "uploads")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "frontend", "public", "uploads")),
            "/app/uploads",
        ]
        valid_dirs = []
        for d in candidate_dirs:
            if d and os.path.exists(d) and d not in valid_dirs:
                valid_dirs.append(d)

        allowed_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico", ".mp4", ".webm", ".pdf"}

        for base_dir in valid_dirs:
            for root, dirs, files in os.walk(base_dir):
                # Filter out hidden directories
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                rel_dir = os.path.relpath(root, base_dir).replace("\\", "/")
                if rel_dir == ".":
                    rel_dir = ""

                cat_for_dir = rel_dir if rel_dir else "Otros"
                categories_set.add(cat_for_dir)

                for f in files:
                    if f.startswith("."):
                        continue
                    ext = os.path.splitext(f)[1].lower()
                    if ext in allowed_exts:
                        rel_path = f"{rel_dir}/{f}" if rel_dir else f
                        if rel_path in seen_rel:
                            continue
                        seen_rel.add(rel_path)

                        full_path = os.path.join(root, f)
                        size_kb = os.path.getsize(full_path) / 1024
                        mtime = os.path.getmtime(full_path)

                        item_url = f"{host_url}/uploads/{rel_path}"

                        media_files.append({
                            "filename": f,
                            "category": cat_for_dir,
                            "url": item_url,
                            "size": f"{size_kb:.2f} KB",
                            "_mtime": mtime
                        })

        # Sort newest first
        media_files.sort(key=lambda x: x["_mtime"], reverse=True)
        for m in media_files:
            m.pop("_mtime", None)

        if category and category.strip() and category.lower() != "todo":
            cat_filter = category.strip().lower()
            media_files = [m for m in media_files if m["category"].lower() == cat_filter or m["category"].lower().startswith(cat_filter + "/")]

        categories = sorted(list(categories_set))
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
async def delete_media_file(request: Request, category: str = None, filename: str = None):
    try:
        files_to_delete = []

        # Check for JSON body for bulk deletion
        try:
            body = await request.json()
            if isinstance(body, dict):
                if "files" in body and isinstance(body["files"], list):
                    files_to_delete = body["files"]
                elif "items" in body and isinstance(body["items"], list):
                    files_to_delete = body["items"]
        except Exception:
            pass

        # If no body, use query params
        if not files_to_delete and filename:
            files_to_delete.append({"category": category or "", "filename": filename})

        if not files_to_delete:
            raise HTTPException(status_code=400, detail="No se especificaron archivos para eliminar")

        candidate_dirs = [
            UPLOAD_DIR,
            os.path.abspath(os.path.join(os.getcwd(), "..", "uploads")),
            os.path.abspath(os.path.join(os.getcwd(), "frontend", "public", "uploads")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "frontend", "public", "uploads")),
            "/app/uploads",
        ]

        deleted_count = 0
        for item in files_to_delete:
            cat = str(item.get("category", "")).strip().replace("..", "").strip("/\\")
            fn = str(item.get("filename", "")).strip().replace("..", "").replace("/", "").replace("\\", "")
            if not fn:
                continue

            for base_dir in candidate_dirs:
                if not os.path.exists(base_dir):
                    continue
                p1 = os.path.join(base_dir, cat, fn)
                p2 = os.path.join(base_dir, fn)
                for p in [p1, p2]:
                    if os.path.exists(p) and os.path.isfile(p):
                        try:
                            os.remove(p)
                            deleted_count += 1
                        except Exception:
                            pass

        return {"status": "success", "deleted": deleted_count, "message": f"{deleted_count} archivo(s) eliminado(s)"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
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
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": admin.role,
        "email": admin.email,
        "name": admin.name
    }

@app.get("/api/admin/me", response_model=AdminSchema)
def get_admin_me(current_admin: Admin = Depends(get_current_admin)):
    return current_admin

# --- ADMIN ACCOUNTS MANAGEMENT ---

@app.get("/api/admin/admins", response_model=list[AdminSchema], dependencies=[Depends(get_current_admin)])
def get_admins(db: Session = Depends(get_db)):
    return db.query(Admin).all()

@app.post("/api/admin/admins", response_model=AdminSchema, dependencies=[Depends(get_current_admin)])
def create_admin(data: AdminCreateSchema, db: Session = Depends(get_db)):
    exist = db.query(Admin).filter(Admin.email == data.email).first()
    if exist:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado como administrador")
    new_admin = Admin(
        email=data.email,
        name=data.name,
        password_hash=get_password_hash(data.password),
        role=data.role or "admin"
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin

@app.put("/api/admin/admins/{admin_id}", response_model=AdminSchema, dependencies=[Depends(get_current_admin)])
def update_admin(admin_id: int, data: dict, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    if data.get("email"):
        admin.email = data["email"]
    if data.get("name"):
        admin.name = data["name"]
    if data.get("role"):
        admin.role = data["role"]
    if data.get("password"):
        admin.password_hash = get_password_hash(data["password"])
    db.commit()
    db.refresh(admin)
    return admin

@app.delete("/api/admin/admins/{admin_id}")
def delete_admin(admin_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    if admin.role == "super_admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar la cuenta de un Super Administrador")
    if admin.id == current_admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    db.delete(admin)
    db.commit()
    return {"message": "Admin eliminado"}



@app.get("/api/admin/users", response_model=list[CustomerSchema], dependencies=[Depends(get_current_admin)])
def get_users(db: Session = Depends(get_db)):
    # Devolver ordenados: primero los no aprobados (por fecha desc), luego los aprobados
    from sqlalchemy import case
    return db.query(Customer).order_by(
        case((Customer.is_approved == False, 0), else_=1),
        Customer.created_at.desc()
    ).all()

@app.post("/api/admin/users", response_model=CustomerSchema, dependencies=[Depends(get_current_admin)])
def create_admin_user(data: CustomerCreateSchema, db: Session = Depends(get_db)):
    exist = db.query(Customer).filter(Customer.email == data.email).first()
    if exist:
        raise HTTPException(status_code=400, detail="Este correo ya esta registrado")
        
    pwd_hash = get_password_hash(data.password)
    new_user = Customer(
        email=data.email, 
        name=data.name, 
        phone=data.phone,
        address=data.address,
        province=data.province,
        city=data.city,
        postal_code=data.postal_code,
        password_hash=pwd_hash, 
        email_verified=True,
        is_approved=True
    )
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

@app.patch("/api/admin/users/{user_id}/approval", response_model=CustomerSchema, dependencies=[Depends(get_current_admin)])
def update_customer_approval(user_id: int, data: CustomerApprovalUpdateSchema, db: Session = Depends(get_db)):
    user = db.query(Customer).filter(Customer.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_approved = data.is_approved
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

# --- Endpoints para Mayoristas & Notificaciones ---

@app.patch("/api/admin/users/{user_id}/wholesale", response_model=CustomerSchema, dependencies=[Depends(get_current_admin)])
def update_customer_wholesale(user_id: int, data: CustomerWholesaleUpdateSchema, db: Session = Depends(get_db)):
    user = db.query(Customer).filter(Customer.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if data.is_wholesale is not None:
        user.is_wholesale = data.is_wholesale
    if data.wholesale_until is not None:
        user.wholesale_until = data.wholesale_until
    db.commit()
    db.refresh(user)
    return user

@app.get("/api/admin/settings/wholesale-auto")
def get_wholesale_auto_setting(db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    setting = db.query(SiteSetting).filter(SiteSetting.key == "wholesale_auto_enabled").first()
    enabled = False
    min_qty = 6
    if setting and isinstance(setting.value, dict):
        enabled = setting.value.get("enabled", False)
        min_qty = setting.value.get("min_quantity", 6)
    elif setting and isinstance(setting.value, bool):
        enabled = setting.value
    return {"enabled": enabled, "min_quantity": min_qty}

@app.patch("/api/admin/settings/wholesale-auto")
def update_wholesale_auto_setting(data: dict, db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    # Solo super admin puede modificar esta opción
    is_super_admin = (current_admin.email.lower() == "guillermo.diarte@gmail.com") or (current_admin.role == "superadmin") or (current_admin.role == "admin")
    if not is_super_admin:
        raise HTTPException(status_code=403, detail="Solo el super administrador puede cambiar esta configuración.")
    
    new_val = bool(data.get("enabled", False))
    min_qty = int(data.get("min_quantity", 6)) if data.get("min_quantity") is not None else 6
    setting = db.query(SiteSetting).filter(SiteSetting.key == "wholesale_auto_enabled").first()
    payload = {"enabled": new_val, "min_quantity": min_qty}
    if not setting:
        setting = SiteSetting(key="wholesale_auto_enabled", value=payload)
        db.add(setting)
    else:
        setting.value = payload
    db.commit()
    return {"status": "ok", "enabled": new_val, "min_quantity": min_qty}

@app.get("/api/admin/notifications/summary")
def get_admin_notifications_summary(db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    import datetime
    current_month = datetime.datetime.utcnow().strftime("%Y-%m")
    
    # 1. Pedidos web en revisión
    pending_orders = db.query(Order).filter(Order.status == "En revisión").all()
    pending_orders_count = len(pending_orders)
    
    # 2. Pedidos web con pagos en cuotas o parciales pendientes de cobro este mes
    # Se notifica si tienen saldo restante (> 0) y aún no fueron marcados como cobrados este mes
    orders_with_debt = db.query(Order).filter(
        Order.status != "Rechazada",
        (Order.payment_status.in_(["pending", "partial"]) | (Order.payment_type == "cuotas"))
    ).all()
    
    installments_pending = []
    for o in orders_with_debt:
        tot = float(o.total or 0)
        paid = float(o.paid_amount or 0)
        rem = max(0.0, tot - paid)
        if rem > 0 and (o.last_installment_paid_month != current_month):
            installments_pending.append({
                "order_number": o.order_number,
                "customer_name": o.customer.name if o.customer else "Cliente",
                "remaining_amount": rem,
                "payment_type": o.payment_type or "cuotas",
                "installments_count": o.installments_count or 1
            })
            
    # 3. Clientes pendientes de aprobación
    pending_customers_count = db.query(Customer).filter(Customer.is_approved == False).count()
    
    total_badge = pending_orders_count + len(installments_pending)
    
    return {
        "pending_web_orders_count": pending_orders_count,
        "installments_pending_this_month": installments_pending,
        "installments_pending_count": len(installments_pending),
        "pending_customers_count": pending_customers_count,
        "total_notifications_count": total_badge,
        "current_month": current_month
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS: PROVEEDORES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/suppliers", response_model=list[SupplierSchema], dependencies=[Depends(get_current_admin)])
def get_suppliers(db: Session = Depends(get_db)):
    """Lista todos los proveedores ordenados por nombre (para autocomplete)."""
    return db.query(Supplier).order_by(Supplier.name).all()


@app.post("/api/admin/suppliers", response_model=SupplierSchema, dependencies=[Depends(get_current_admin)])
def create_supplier(data: SupplierCreateSchema, db: Session = Depends(get_db)):
    """Crea un proveedor nuevo. Si ya existe con ese nombre, lo devuelve."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del proveedor no puede estar vacío")
    existing = db.query(Supplier).filter(Supplier.name.ilike(name)).first()
    if existing:
        return existing
    supplier = Supplier(name=name)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS: LOTES DE COMPRA
# ─────────────────────────────────────────────────────────────────────────────

def _generate_batch_number(db: Session) -> str:
    """Genera un número de lote único: LOTE-YYYYMMDD-NNN."""
    import datetime as dt
    today = dt.date.today().strftime("%Y%m%d")
    prefix = f"LOTE-{today}-"
    last = (
        db.query(PurchaseBatch)
        .filter(PurchaseBatch.batch_number.like(f"{prefix}%"))
        .order_by(PurchaseBatch.batch_number.desc())
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.batch_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}{seq:03d}"


@app.get("/api/admin/purchase-batches", dependencies=[Depends(get_current_admin)])
def get_purchase_batches(
    skip: int = 0,
    limit: int = 50,
    supplier_id: int = None,
    db: Session = Depends(get_db)
):
    """Lista lotes de compra con datos de proveedor resueltos (para el historial)."""
    query = db.query(PurchaseBatch).order_by(PurchaseBatch.purchase_date.desc(), PurchaseBatch.id.desc())
    if supplier_id:
        query = query.filter(PurchaseBatch.supplier_id == supplier_id)
    total = query.count()
    batches = query.offset(skip).limit(limit).all()

    result = []
    for b in batches:
        supplier_name = b.supplier.name if b.supplier else None
        items_count = len(b.items)
        result.append({
            "id": b.id,
            "batch_number": b.batch_number,
            "supplier_id": b.supplier_id,
            "supplier_name": supplier_name,
            "purchase_date": b.purchase_date.isoformat() if b.purchase_date else None,
            "currency": b.currency,
            "exchange_rate": b.exchange_rate,
            "shipping_currency": b.shipping_currency,
            "shipping_cost_original": b.shipping_cost_original,
            "shipping_cost_ars": b.shipping_cost_ars,
            "total_products_ars": b.total_products_ars,
            "total_cost_ars": b.total_cost_ars,
            "notes": b.notes,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "items_count": items_count,
        })
    return {"total": total, "batches": result}


@app.get("/api/admin/purchase-batches/{batch_id}", dependencies=[Depends(get_current_admin)])
def get_purchase_batch(batch_id: int, db: Session = Depends(get_db)):
    """Devuelve el detalle completo de un lote con todos sus ítems."""
    batch = db.query(PurchaseBatch).filter(PurchaseBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    supplier_name = batch.supplier.name if batch.supplier else None
    return {
        "id": batch.id,
        "batch_number": batch.batch_number,
        "supplier_id": batch.supplier_id,
        "supplier_name": supplier_name,
        "purchase_date": batch.purchase_date.isoformat() if batch.purchase_date else None,
        "currency": batch.currency,
        "exchange_rate": batch.exchange_rate,
        "shipping_currency": batch.shipping_currency,
        "shipping_cost_original": batch.shipping_cost_original,
        "shipping_cost_ars": batch.shipping_cost_ars,
        "total_products_ars": batch.total_products_ars,
        "total_cost_ars": batch.total_cost_ars,
        "notes": batch.notes,
        "created_at": batch.created_at.isoformat() if batch.created_at else None,
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "variant_id": it.variant_id,
                "product_name": it.product_name,
                "variant_label": it.variant_label,
                "quantity": it.quantity,
                "unit_cost_original": it.unit_cost_original,
                "unit_cost_ars": it.unit_cost_ars,
                "shipping_per_unit_ars": it.shipping_per_unit_ars,
                "total_cost_per_unit_ars": it.total_cost_per_unit_ars,
                "sale_price": it.sale_price,
            }
            for it in batch.items
        ],
    }


@app.post("/api/admin/purchase-batches", dependencies=[Depends(get_current_admin)])
def create_purchase_batch(data: PurchaseBatchCreateSchema, db: Session = Depends(get_db)):
    """
    Crea un lote de compra completo:
    1. Resuelve/crea el proveedor si se envió nombre.
    2. Genera número de lote automático.
    3. Guarda el batch y sus ítems.
    """
    import datetime as dt

    # 1. Proveedor
    supplier_id = None
    if data.supplier_name and data.supplier_name.strip():
        name = data.supplier_name.strip()
        supplier = db.query(Supplier).filter(Supplier.name.ilike(name)).first()
        if not supplier:
            supplier = Supplier(name=name)
            db.add(supplier)
            db.flush()  # obtener ID sin commit
        supplier_id = supplier.id

    # 2. Parsear fecha
    try:
        purchase_date = dt.datetime.fromisoformat(data.purchase_date)
    except ValueError:
        purchase_date = dt.datetime.utcnow()

    # 3. Número de lote
    batch_number = _generate_batch_number(db)

    # 4. Crear batch
    batch = PurchaseBatch(
        batch_number=batch_number,
        supplier_id=supplier_id,
        purchase_date=purchase_date,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        shipping_currency=data.shipping_currency,
        shipping_cost_original=data.shipping_cost_original,
        shipping_cost_ars=data.shipping_cost_ars,
        total_products_ars=data.total_products_ars,
        total_cost_ars=data.total_cost_ars,
        notes=data.notes,
    )
    db.add(batch)
    db.flush()  # obtener batch.id

    # 5. Crear ítems
    for it in data.items:
        item = PurchaseBatchItem(
            batch_id=batch.id,
            product_id=it.product_id,
            variant_id=it.variant_id,
            product_name=it.product_name,
            variant_label=it.variant_label,
            quantity=it.quantity,
            unit_cost_original=it.unit_cost_original,
            unit_cost_ars=it.unit_cost_ars,
            shipping_per_unit_ars=it.shipping_per_unit_ars,
            total_cost_per_unit_ars=it.total_cost_per_unit_ars,
            sale_price=it.sale_price,
        )
        db.add(item)

    db.commit()
    db.refresh(batch)

    return {
        "id": batch.id,
        "batch_number": batch.batch_number,
        "supplier_id": batch.supplier_id,
        "supplier_name": data.supplier_name,
        "total_cost_ars": batch.total_cost_ars,
        "items_count": len(data.items),
    }
