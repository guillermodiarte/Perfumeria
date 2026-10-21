import os
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from app.models import Customer, Admin
from app.auth import get_token_payload

SQLALCHEMY_DATABASE_URL = os.environ.get("SQLALCHEMY_DATABASE_URL", "sqlite:///./perfumeria.db")
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = lambda: Session(bind=engine)

# Email del super admin protegido — nunca se puede cambiar su rol ni eliminarlo
PROTECTED_SUPER_ADMIN_EMAIL = "guillermo.diarte@gmail.com"

# Todos los roles válidos del sistema admin
VALID_ADMIN_ROLES = {"super_admin", "admin", "empleado", "viewer"}
# Incluimos 'editor' como alias legacy de 'empleado' para compatibilidad
ALL_ALLOWED_ROLES = {"super_admin", "admin", "empleado", "viewer", "editor"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_customer(db: Session = Depends(get_db), payload: dict = Depends(get_token_payload)):
    if payload.get("role") not in ["cliente", "customer"]:
        raise HTTPException(status_code=403, detail="No tienes permisos de cliente")
    email = payload.get("sub")
    customer = db.query(Customer).filter(Customer.email == email).first()
    if not customer:
        raise HTTPException(status_code=403, detail="Cliente no encontrado")
    return customer

def get_current_admin(db: Session = Depends(get_db), payload: dict = Depends(get_token_payload)):
    """Permite acceso a CUALQUIER rol admin (super_admin, admin, empleado, viewer, editor legacy)."""
    if payload.get("role") not in ALL_ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    email = payload.get("sub")
    admin = db.query(Admin).filter(Admin.email == email).first()
    if not admin:
        raise HTTPException(status_code=403, detail="Administrador no encontrado")
    return admin

def require_role(*roles: str):
    """
    Factory que devuelve una dependencia FastAPI que verifica que el admin
    tenga uno de los roles especificados. Uso:
        dependencies=[Depends(require_role("super_admin", "admin"))]
    """
    def _checker(current_admin: Admin = Depends(get_current_admin)):
        if current_admin.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"No tienes permiso para esta acción. Rol requerido: {', '.join(roles)}"
            )
        return current_admin
    return _checker

# ─── Funciones helper de verificación de rol ───────────────────────────────

def is_super_admin(admin: Admin) -> bool:
    """True si el admin es super_admin (incluyendo la cuenta protegida)."""
    return admin.role == "super_admin" or admin.email.lower() == PROTECTED_SUPER_ADMIN_EMAIL

def is_at_least_admin(admin: Admin) -> bool:
    """True si tiene rol 'admin' o superior."""
    return admin.role in ("super_admin", "admin") or admin.email.lower() == PROTECTED_SUPER_ADMIN_EMAIL

def is_at_least_empleado(admin: Admin) -> bool:
    """True si puede realizar operaciones de caja/compras (empleado, admin, super_admin)."""
    return admin.role in ("super_admin", "admin", "empleado", "editor") or admin.email.lower() == PROTECTED_SUPER_ADMIN_EMAIL
