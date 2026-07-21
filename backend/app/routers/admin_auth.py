from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models import Admin
from app.schemas import AdminCreateSchema, AdminSchema, LoginSchema, Token
from app.auth import get_password_hash, verify_password, create_access_token
from app.dependencies import get_db, get_current_admin

router = APIRouter(prefix="/api/admin/auth", tags=["admin_auth"])

@router.post("/login", response_model=Token)
def login_admin(admin: LoginSchema, db: Session = Depends(get_db)):
    db_admin = db.query(Admin).filter(Admin.email == admin.email).first()
    if not db_admin or not verify_password(admin.password, db_admin.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    
    access_token = create_access_token(data={"sub": db_admin.email, "role": db_admin.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=AdminSchema)
def get_admin_me(current_admin: Admin = Depends(get_current_admin)):
    return current_admin
