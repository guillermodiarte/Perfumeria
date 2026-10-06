from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime




class CustomerBaseSchema(BaseModel):
    email: str
    name: str
    phone: str
    address: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None

class CustomerCreateSchema(CustomerBaseSchema):
    password: str

class CustomerUpdateSchema(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None

class LoginSchema(BaseModel):
    email: str
    password: str

class CustomerSchema(CustomerBaseSchema):
    id: int
    email_verified: bool
    is_approved: bool
    is_wholesale: Optional[bool] = False
    wholesale_until: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class CustomerApprovalUpdateSchema(BaseModel):
    is_approved: bool

class CustomerWholesaleUpdateSchema(BaseModel):
    is_wholesale: Optional[bool] = None
    wholesale_until: Optional[datetime] = None

class AdminBaseSchema(BaseModel):
    email: str
    name: str

class AdminCreateSchema(AdminBaseSchema):
    password: str
    role: Optional[str] = "admin"

class AdminSchema(AdminBaseSchema):
    id: int
    role: str
    model_config = ConfigDict(from_attributes=True)

class ProvinceSchema(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class CitySchema(BaseModel):
    id: int
    province_id: int
    name: str
    postal_code: str
    model_config = ConfigDict(from_attributes=True)

class TokenData(BaseModel):
    email: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    role: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None

class SiteSettingSchema(BaseModel):
    id: int
    key: str
    value: dict | list | str | int | bool | float | None

    model_config = ConfigDict(from_attributes=True)

class SiteSettingUpdateSchema(BaseModel):
    value: dict | list | str | int | bool | float | None

class MediaMoveSchema(BaseModel):
    new_category: str


# === SCHEMAS: M\u00d3DULO DE COMPRAS ===

class SupplierCreateSchema(BaseModel):
    name: str

class SupplierSchema(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class PurchaseBatchItemCreateSchema(BaseModel):
    product_id: str
    variant_id: str
    product_name: Optional[str] = None
    variant_label: Optional[str] = None
    quantity: int
    unit_cost_original: float
    unit_cost_ars: float
    shipping_per_unit_ars: float
    total_cost_per_unit_ars: float
    sale_price: float

class PurchaseBatchItemSchema(PurchaseBatchItemCreateSchema):
    id: int
    batch_id: int
    model_config = ConfigDict(from_attributes=True)


class PurchaseBatchCreateSchema(BaseModel):
    supplier_name: Optional[str] = None   # se crea/busca autom\u00e1ticamente
    purchase_date: str                    # ISO string ej: "2026-10-06"
    currency: str = "ARS"                 # ARS | USD | BRL | PYG
    exchange_rate: float = 1.0
    shipping_currency: str = "ARS"
    shipping_cost_original: float = 0.0
    shipping_cost_ars: float = 0.0
    total_products_ars: float = 0.0
    total_cost_ars: float = 0.0
    notes: Optional[str] = None
    items: List[PurchaseBatchItemCreateSchema]

class PurchaseBatchSchema(BaseModel):
    id: int
    batch_number: str
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None   # campo resuelto en el endpoint
    purchase_date: Optional[datetime] = None
    currency: str
    exchange_rate: float
    shipping_currency: str
    shipping_cost_original: float
    shipping_cost_ars: float
    total_products_ars: float
    total_cost_ars: float
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[PurchaseBatchItemSchema] = []
    model_config = ConfigDict(from_attributes=True)
