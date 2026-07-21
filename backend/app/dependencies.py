import os
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from app.models import Customer, Admin
from app.auth import get_token_payload

SQLALCHEMY_DATABASE_URL = os.environ.get("SQLALCHEMY_DATABASE_URL", "sqlite:///./perfumeria.db")
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = lambda: Session(bind=engine)

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
    if payload.get("role") not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    
    email = payload.get("sub")
    admin = db.query(Admin).filter(Admin.email == email).first()
    if not admin:
        raise HTTPException(status_code=403, detail="Administrador no encontrado")
    return admin
