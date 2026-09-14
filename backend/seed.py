import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Admin, SiteSetting

# Database Setup para el Seed
SQLALCHEMY_DATABASE_URL = os.environ.get("SQLALCHEMY_DATABASE_URL", "sqlite:///./perfumeria.db")
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed():
    # Inicializar Base de datos
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Configuración de Acceso y Contacto (Super Admin)
        admin_email = "guillermo.diarte@gmail.com"
        admin_pass = "Gad33224122" # Temporal mock
        
        admin_user = db.query(Admin).filter(Admin.email == admin_email).first()
        if not admin_user:
            print("Creando Admin Inicial...")
            from app.auth import get_password_hash
            hashed = get_password_hash(admin_pass)
            new_admin = Admin(email=admin_email, password_hash=hashed, role="super_admin", name="Super Admin")
            db.add(new_admin)
            db.commit()

        new_admin_email = "tiendadeportiva.contacto@gmail.com"
        new_admin_pass = "tiendadeportiva26"
        new_admin_user = db.query(Admin).filter(Admin.email == new_admin_email).first()
        if not new_admin_user:
            print("Creando Admin Tienda Deportiva...")
            from app.auth import get_password_hash
            hashed = get_password_hash(new_admin_pass)
            new_admin2 = Admin(email=new_admin_email, password_hash=hashed, role="admin", name="Tienda Deportiva y Accesorios")
            db.add(new_admin2)
            db.commit()

        # 3. Configuraciones Dinamicas del Sitio (Secciones)
        print("Verificando configuraciones del sitio...")
        default_settings = {
            'home_banner': { 
                "slides": [
                    {
                        "tagline": "TIENDA DEPORTIVA Y ACCESORIOS",
                        "title": "ENTRENA AL MÁXIMO", 
                        "subtitle": "INDUMENTARIA DEPORTIVA",
                        "mediaUrl": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1600&q=80",
                        "link": "/catalog"
                    }
                ]
            },
            'home_categories': { "categoryIds": [] },
            'home_latest': { "useAuto": True, "productIds": [] },
            'site_header': { 
                "logoUrl": "", 
                "showSocials": True, 
                "facebookUrl": "#", 
                "instagramUrl": "#",
                "whatsapp": "5493513146924"
            },
            'site_footer': { 
                "logoUrl": "", 
                "copyRight": "© 2026 Tienda Deportiva y Accesorios. Todos los derechos reservados." 
            }
        }
        
        for key, value in default_settings.items():
            existing = db.query(SiteSetting).filter(SiteSetting.key == key).first()
            if not existing:
                print(f"Creando preconfiguracion de seccion: {key}")
                new_setting = SiteSetting(key=key, value=value)
                db.add(new_setting)
                
        db.commit()
        print("¡Seed finalizado con éxito!")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
