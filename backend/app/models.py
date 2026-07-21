from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Numeric, JSON, DateTime
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

class SiteSetting(Base):
    __tablename__ = "site_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=False) # Guardará listas o diccionarios configurados desde el Frontend




# === ESTRUCTURAS DE LOCALIDADES ===
class Province(Base):
    __tablename__ = "provinces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    cities = relationship("City", back_populates="province")


class City(Base):
    __tablename__ = "cities"
    id = Column(Integer, primary_key=True, index=True)
    province_id = Column(Integer, ForeignKey("provinces.id"))
    name = Column(String, index=True)
    postal_code = Column(String)

    province = relationship("Province", back_populates="cities")


# === ESTRUCTURAS DE USUARIO ===
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    
    address = Column(String, nullable=True)
    province = Column(String, nullable=True)
    city = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)

    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)

    orders = relationship("Order", back_populates="customer")
    cart_items = relationship("CartItem", back_populates="customer")


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, default="admin") # admin, editor



class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("customers.id"))
    product_id = Column(String, nullable=False) # Frontend usa strings para IDs
    variant_id = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    
    customer = relationship("Customer", back_populates="cart_items")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("customers.id"))
    status = Column(String, default="Pendiente de pago") # Pendiente de pago, Pagada, etc.
    total = Column(Numeric(10, 2))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(String, nullable=False)
    variant_id = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    price = Column(Numeric(10, 2))

    order = relationship("Order", back_populates="items")
