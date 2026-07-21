from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models import Province, City
from app.dependencies import get_db

router = APIRouter(prefix="/api/locations", tags=["locations"])

@router.get("/provinces")
def get_provinces(db: Session = Depends(get_db)):
    provinces = db.query(Province).order_by(Province.name).all()
    return provinces

@router.get("/provinces/{province_id}/cities")
def get_cities(province_id: int, db: Session = Depends(get_db)):
    cities = db.query(City).filter(City.province_id == province_id).order_by(City.name).all()
    return cities
