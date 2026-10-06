from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Numeric, JSON, DateTime, Text
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
    is_approved = Column(Boolean, default=False)
    is_wholesale = Column(Boolean, default=False)
    wholesale_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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
    status = Column(String, default="En revisión") # En revisión, Aprobada, Rechazada, etc.
    payment_status = Column(String, default="pending") # pending, partial, full
    payment_type = Column(String, default="total") # total, partial, cuotas
    installments_count = Column(Integer, default=1)
    last_installment_paid_month = Column(String, nullable=True)
    delivery_status = Column(String, default="pending") # pending, shipped, delivered
    paid_amount = Column(Numeric(10, 2), default=0.0)
    total = Column(Numeric(10, 2))
    admin_notes = Column(String, nullable=True)
    shipping_type = Column(String, nullable=True)          # 'delivery' | 'pickup'
    shipping_cost = Column(Numeric(10, 2), default=0.0)
    shipping_tracking_number = Column(String, nullable=True)
    shipping_invoice_url = Column(String, nullable=True)
    shipped_at = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(String, nullable=False)
    variant_id = Column(String, nullable=False)
    product_name = Column(String, nullable=True)
    variant_info = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    price = Column(Numeric(10, 2))

    order = relationship("Order", back_populates="items")


# === MÓDULO DE COMPRAS / INGRESO DE MERCADERÍA ===

class Supplier(Base):
    """Tabla de proveedores para el módulo de compras."""
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    purchase_batches = relationship("PurchaseBatch", back_populates="supplier")


class PurchaseBatch(Base):
    """Encabezado de un lote de compra (una factura/viaje de compras)."""
    __tablename__ = "purchase_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, unique=True, index=True)  # ej: LOTE-20261006-001
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    purchase_date = Column(DateTime, nullable=False)
    # Moneda de la compra
    currency = Column(String, default="ARS")           # ARS | USD | BRL | PYG
    exchange_rate = Column(Float, default=1.0)          # cotización vs ARS (1 si es ARS)
    # Costo de envío
    shipping_currency = Column(String, default="ARS")  # moneda del envío
    shipping_cost_original = Column(Float, default=0.0) # valor en moneda elegida
    shipping_cost_ars = Column(Float, default=0.0)      # convertido a ARS
    # Totales
    total_products_ars = Column(Float, default=0.0)     # suma de productos en ARS
    total_cost_ars = Column(Float, default=0.0)         # total lote en ARS (productos + envío)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    supplier = relationship("Supplier", back_populates="purchase_batches")
    items = relationship("PurchaseBatchItem", back_populates="batch", cascade="all, delete-orphan")


class PurchaseBatchItem(Base):
    """Ítem individual dentro de un lote de compra (por variante)."""
    __tablename__ = "purchase_batch_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("purchase_batches.id"), nullable=False)
    product_id = Column(String, nullable=False)          # ID en Zustand/frontend
    variant_id = Column(String, nullable=False)          # ID de variante
    product_name = Column(String, nullable=True)
    variant_label = Column(String, nullable=True)        # ej: "100ml (Grande) - Azul"
    quantity = Column(Integer, default=1)
    unit_cost_original = Column(Float, default=0.0)     # en moneda de la compra
    unit_cost_ars = Column(Float, default=0.0)           # convertido a ARS
    shipping_per_unit_ars = Column(Float, default=0.0)  # envío proporcional ÷ cantidad
    total_cost_per_unit_ars = Column(Float, default=0.0) # unit_cost_ars + shipping_per_unit_ars
    sale_price = Column(Float, default=0.0)              # PV final ingresado por el admin

    batch = relationship("PurchaseBatch", back_populates="items")
