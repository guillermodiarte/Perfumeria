import os
import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Province, City

SQLALCHEMY_DATABASE_URL = os.environ.get("SQLALCHEMY_DATABASE_URL", "sqlite:///./perfumeria.db")
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_locations():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Province).count() > 0:
            print("Las provincias ya están cargadas.")
            return

        print("Descargando Provincias...")
        res = requests.get("https://apis.datos.gob.ar/georef/api/provincias")
        if res.status_code == 200:
            provincias_data = res.json().get("provincias", [])
            for prov in provincias_data:
                # Insert Province
                new_prov = Province(name=prov["nombre"])
                db.add(new_prov)
                db.commit()
                db.refresh(new_prov)
                
                print(f"Descargando Localidades para {new_prov.name}...")
                # Fetch localities for this province
                loc_res = requests.get(f"https://apis.datos.gob.ar/georef/api/localidades?provincia={prov['id']}&max=5000")
                if loc_res.status_code == 200:
                    localidades_data = loc_res.json().get("localidades", [])
                    # We will bulk insert to speed up
                    cities = []
                    # Keep track of unique names in the province to avoid exact duplicates
                    seen_names = set()
                    for loc in localidades_data:
                        name = loc["nombre"]
                        if name not in seen_names:
                            # We can mock postal code if not available in this endpoint (it isn't directly without another api call)
                            cities.append(City(province_id=new_prov.id, name=name, postal_code="3000"))
                            seen_names.add(name)
                    
                    if cities:
                        db.bulk_save_objects(cities)
                        db.commit()
        print("¡Localidades cargadas con éxito!")
    except Exception as e:
        print("Error durante el seeding de localidades:", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed_locations()
