from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from app.models import Customer
from app.schemas import CustomerCreateSchema, CustomerSchema, CustomerUpdateSchema, LoginSchema, Token
from app.auth import get_password_hash, verify_password, create_access_token
from app.dependencies import get_db, get_current_customer

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=CustomerSchema)
def register_user(user: CustomerCreateSchema, db: Session = Depends(get_db)):
    existing_email = db.query(Customer).filter(Customer.email == user.email).first()
    if existing_email:
        if not existing_email.is_approved:
            raise HTTPException(
                status_code=400,
                detail="pending_approval:Tu solicitud de registro ya está en proceso a la espera de la aprobación de un administrador."
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="El correo electrónico ya está registrado. Por favor inicia sesión."
            )
    
    existing_phone = db.query(Customer).filter(Customer.phone == user.phone).first()
    if existing_phone:
        if not existing_phone.is_approved:
            raise HTTPException(
                status_code=400,
                detail="pending_approval:Tu solicitud con este número de celular ya está en proceso de aprobación."
            )
        else:
            raise HTTPException(status_code=400, detail="El número de celular ya está registrado.")

    hashed_pw = get_password_hash(user.password)
    
    new_user = Customer(
        email=user.email,
        password_hash=hashed_pw,
        name=user.name,
        phone=user.phone,
        address=user.address,
        province=user.province,
        city=user.city,
        postal_code=user.postal_code,
        email_verified=False,
        is_approved=False,
        verification_token=str(uuid.uuid4())
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"\n--- NUEVA SOLICITUD DE REGISTRO ---")
    print(f"Nombre: {user.name}")
    print(f"Email: {user.email}")
    print(f"Teléfono: {user.phone}")
    print(f"Ingresar al panel admin para aprobar la solicitud.")
    print(f"----------------------------------\n")
    
    return new_user

@router.post("/login", response_model=Token)
def login(user: LoginSchema, db: Session = Depends(get_db)):
    db_user = db.query(Customer).filter(Customer.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    
    if not db_user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="pending_approval:Tu cuenta aún no ha sido aprobada por un administrador. Tu solicitud está en proceso."
        )
    
    access_token = create_access_token(data={"sub": db_user.email, "role": "cliente"})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(Customer).filter(Customer.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido o expirado.")
    
    user.email_verified = True
    user.verification_token = None
    db.commit()
    return {"status": "ok", "message": "Correo verificado correctamente."}

@router.get("/me", response_model=CustomerSchema)
def get_me(current_user: Customer = Depends(get_current_customer)):
    return current_user

@router.put("/me", response_model=CustomerSchema)
def update_me(update_data: CustomerUpdateSchema, db: Session = Depends(get_db), current_user: Customer = Depends(get_current_customer)):
    if update_data.email and update_data.email != current_user.email:
        if db.query(Customer).filter(Customer.email == update_data.email).first():
            raise HTTPException(status_code=400, detail="El correo electrónico ya está en uso.")
        current_user.email = update_data.email
        current_user.email_verified = False
        current_user.verification_token = str(uuid.uuid4())

    if update_data.phone and update_data.phone != current_user.phone:
        if db.query(Customer).filter(Customer.phone == update_data.phone).first():
            raise HTTPException(status_code=400, detail="El celular ya está en uso.")
        current_user.phone = update_data.phone

    if update_data.password:
        current_user.password_hash = get_password_hash(update_data.password)
    
    if update_data.name is not None: current_user.name = update_data.name
    if update_data.address is not None: current_user.address = update_data.address
    if update_data.province is not None: current_user.province = update_data.province
    if update_data.city is not None: current_user.city = update_data.city
    if update_data.postal_code is not None: current_user.postal_code = update_data.postal_code

    db.commit()
    db.refresh(current_user)
    return current_user
