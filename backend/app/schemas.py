from pydantic import BaseModel, ConfigDict
from typing import List, Optional




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
    model_config = ConfigDict(from_attributes=True)

class AdminBaseSchema(BaseModel):
    email: str
    name: str

class AdminCreateSchema(AdminBaseSchema):
    password: str

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

class SiteSettingSchema(BaseModel):
    id: int
    key: str
    value: dict | list | str | int | bool | float | None

    model_config = ConfigDict(from_attributes=True)

class SiteSettingUpdateSchema(BaseModel):
    value: dict | list | str | int | bool | float | None

class MediaMoveSchema(BaseModel):
    new_category: str
