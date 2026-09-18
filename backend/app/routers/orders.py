from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
import datetime
from pydantic import BaseModel
from typing import List, Optional
from app.models import Customer, Order, OrderItem, Admin, SiteSetting
from app.dependencies import get_db, get_current_customer, get_current_admin

router = APIRouter(prefix="/api/orders", tags=["orders"])

class OrderItemSchema(BaseModel):
    product_id: Optional[str] = None
    productId: Optional[str] = None
    variant_id: Optional[str] = None
    variantId: Optional[str] = None
    product_name: Optional[str] = None
    productName: Optional[str] = None
    variant_info: Optional[str] = None
    variantInfo: Optional[str] = None
    image_url: Optional[str] = None
    imageUrl: Optional[str] = None
    quantity: int = 1
    sale_price: Optional[float] = None
    salePrice: Optional[float] = None

class CreateOrderSchema(BaseModel):
    order_number: Optional[str] = None
    items: List[OrderItemSchema]
    shipping_type: Optional[str] = 'delivery'  # 'delivery' | 'pickup'
    shipping_cost: Optional[float] = 0.0

class UpdateOrderStatusSchema(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    payment_type: Optional[str] = None
    installments_count: Optional[int] = None
    last_installment_paid_month: Optional[str] = None
    delivery_status: Optional[str] = None  # 'pending' | 'shipped' | 'delivered'
    paid_amount: Optional[float] = None
    admin_notes: Optional[str] = None
    shipping_type: Optional[str] = None
    shipping_cost: Optional[float] = None
    shipping_tracking_number: Optional[str] = None
    shipping_invoice_url: Optional[str] = None
    shipped_at: Optional[str] = None

@router.post("")
def create_order(order_data: CreateOrderSchema, db: Session = Depends(get_db), current_user: Customer = Depends(get_current_customer)):
    if not current_user.is_approved:
        raise HTTPException(status_code=403, detail="Tu cuenta está pendiente de aprobación por un administrador para poder realizar compras.")
    
    if not order_data.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío.")

    parsed_items = []
    for i in order_data.items:
        pid = i.product_id or i.productId
        vid = i.variant_id or i.variantId
        pname = i.product_name or i.productName or "Producto"
        vinfo = i.variant_info or i.variantInfo or ""
        img = i.image_url or i.imageUrl or ""
        price = i.sale_price if i.sale_price is not None else (i.salePrice if i.salePrice is not None else 0.0)
        if not pid or not vid:
            raise HTTPException(status_code=400, detail="Faltan datos del producto o variante")
        parsed_items.append({
            "product_id": pid,
            "variant_id": vid,
            "product_name": pname,
            "variant_info": vinfo,
            "image_url": img,
            "quantity": i.quantity,
            "price": price
        })
    
    total = sum(i["quantity"] * i["price"] for i in parsed_items)
    order_number = order_data.order_number or ("ORD-" + str(uuid.uuid4())[:8].upper())
    
    new_order = Order(
        user_id=current_user.id,
        order_number=order_number,
        status="En revisión",
        payment_status="pending",
        delivery_status="pending",
        paid_amount=0.0,
        total=total,
        shipping_type=order_data.shipping_type or 'delivery',
        shipping_cost=order_data.shipping_cost or 0.0
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    for item in parsed_items:
        db.add(OrderItem(
            order_id=new_order.id,
            product_id=item["product_id"],
            variant_id=item["variant_id"],
            product_name=item["product_name"],
            variant_info=item["variant_info"],
            image_url=item["image_url"],
            quantity=item["quantity"],
            price=item["price"]
        ))
    db.commit()
    
    return {"status": "ok", "order_number": order_number}

@router.get("")
def get_orders(db: Session = Depends(get_db), current_user: Customer = Depends(get_current_customer)):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).all()
    res = []
    for o in orders:
        tot = float(o.total) if o.total is not None else 0.0
        paid = float(o.paid_amount) if o.paid_amount is not None else 0.0
        remaining = max(0.0, tot - paid)
        res.append({
            "order_number": o.order_number,
            "status": o.status or "En revisión",
            "payment_status": o.payment_status or "pending",
            "payment_type": o.payment_type or "total",
            "installments_count": o.installments_count or 1,
            "last_installment_paid_month": o.last_installment_paid_month,
            "delivery_status": o.delivery_status or "pending",
            "total": tot,
            "paid_amount": paid,
            "remaining_amount": remaining,
            "admin_notes": o.admin_notes,
            "created_at": o.created_at,
            "items": [
                {
                    "product_id": i.product_id,
                    "variant_id": i.variant_id,
                    "product_name": i.product_name,
                    "variant_info": i.variant_info,
                    "image_url": i.image_url,
                    "quantity": i.quantity,
                    "price": float(i.price) if i.price is not None else 0.0
                } for i in o.items
            ]
        })
    return res

# --- ENDPOINTS ADMINISTRATIVOS ---

@router.get("/admin/all")
def get_all_orders_admin(db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    res = []
    for o in orders:
        cust = o.customer
        tot = float(o.total) if o.total is not None else 0.0
        paid = float(o.paid_amount) if o.paid_amount is not None else 0.0
        remaining = max(0.0, tot - paid)
        res.append({
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status or "En revisión",
            "payment_status": o.payment_status or "pending",
            "payment_type": o.payment_type or "total",
            "installments_count": o.installments_count or 1,
            "last_installment_paid_month": o.last_installment_paid_month,
            "delivery_status": o.delivery_status or "pending",
            "total": tot,
            "paid_amount": paid,
            "remaining_amount": remaining,
            "admin_notes": o.admin_notes,
            "shipping_type": o.shipping_type or "delivery",
            "shipping_cost": float(o.shipping_cost) if o.shipping_cost is not None else 0.0,
            "shipping_tracking_number": o.shipping_tracking_number,
            "shipping_invoice_url": o.shipping_invoice_url,
            "shipped_at": o.shipped_at,
            "created_at": o.created_at,
            "customer": {
                "id": cust.id if cust else None,
                "name": cust.name if cust else "Cliente",
                "email": cust.email if cust else "",
                "phone": cust.phone if cust else "",
                "is_wholesale": cust.is_wholesale if cust else False,
                "wholesale_until": cust.wholesale_until if cust else None
            },
            "items": [
                {
                    "product_id": i.product_id,
                    "variant_id": i.variant_id,
                    "product_name": i.product_name,
                    "variant_info": i.variant_info,
                    "image_url": i.image_url,
                    "quantity": i.quantity,
                    "price": float(i.price) if i.price is not None else 0.0
                } for i in o.items
            ]
        })
    return res

@router.patch("/admin/{order_number}/status")
def update_order_status_admin(order_number: str, data: UpdateOrderStatusSchema, db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    order = db.query(Order).filter(Order.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    was_already_approved = (order.status or "").lower().startswith("aprob")
    
    if data.status is not None:
        order.status = data.status
        s_norm = str(data.status).lower()
        if ("rechaz" in s_norm or "cancel" in s_norm) and data.delivery_status is None:
            order.delivery_status = "cancelled"
    if data.payment_status is not None:
        order.payment_status = data.payment_status
    if data.payment_type is not None:
        order.payment_type = data.payment_type
    if data.installments_count is not None:
        order.installments_count = data.installments_count
    if data.last_installment_paid_month is not None:
        order.last_installment_paid_month = data.last_installment_paid_month
    if data.delivery_status is not None:
        order.delivery_status = data.delivery_status
    if data.paid_amount is not None:
        order.paid_amount = data.paid_amount
    if data.admin_notes is not None:
        order.admin_notes = data.admin_notes
    if data.shipping_type is not None:
        order.shipping_type = data.shipping_type
    if data.shipping_cost is not None:
        order.shipping_cost = data.shipping_cost
    if data.shipping_tracking_number is not None:
        order.shipping_tracking_number = data.shipping_tracking_number
    if data.shipping_invoice_url is not None:
        order.shipping_invoice_url = data.shipping_invoice_url
    if data.shipped_at is not None:
        order.shipped_at = data.shipped_at

    # Verificar si al aprobar se renueva la cuenta mayorista automática (por 30 días)
    now_approved = (order.status or "").lower().startswith("aprob")
    if now_approved and not was_already_approved and order.customer:
        # Chequear si está habilitado el auto mayorista
        setting = db.query(SiteSetting).filter(SiteSetting.key == "wholesale_auto_enabled").first()
        auto_enabled = False
        if setting and isinstance(setting.value, dict):
            auto_enabled = setting.value.get("enabled", False)
            min_qty = int(setting.value.get("min_quantity", 6))
        elif setting and isinstance(setting.value, bool):
            auto_enabled = setting.value
            min_qty = 6
        else:
            min_qty = 6
            
        if auto_enabled:
            # Si compró la cantidad mínima de artículos requerida para calificar como mayorista
            total_items = sum(i.quantity for i in order.items)
            if total_items >= min_qty:
                new_until = datetime.datetime.utcnow() + datetime.timedelta(days=30)
                order.customer.wholesale_until = new_until

    db.commit()
    db.refresh(order)
    
    tot = float(order.total) if order.total is not None else 0.0
    paid = float(order.paid_amount) if order.paid_amount is not None else 0.0
    
    return {
        "status": "ok",
        "order_number": order.order_number,
        "order_status": order.status,
        "payment_status": order.payment_status,
        "payment_type": order.payment_type,
        "installments_count": order.installments_count,
        "last_installment_paid_month": order.last_installment_paid_month,
        "delivery_status": order.delivery_status,
        "paid_amount": paid,
        "remaining_amount": max(0.0, tot - paid)
    }

@router.delete("/{order_number}")
def delete_order_customer(order_number: str, db: Session = Depends(get_db), current_user: Customer = Depends(get_current_customer)):
    order = db.query(Order).filter(Order.order_number == order_number, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    # Check if order was already approved, delivered or paid
    s = (order.status or "").lower()
    p = (order.payment_status or "").lower()
    d = (order.delivery_status or "").lower()
    if "aprob" in s or "entreg" in s or "entreg" in d or p in ["full", "partial"] or (order.paid_amount and float(order.paid_amount) > 0):
        raise HTTPException(status_code=400, detail="No podés eliminar un pedido que ya fue aceptado o pagado.")
    
    items_data = [
        {
            "product_id": i.product_id,
            "variant_id": i.variant_id,
            "quantity": i.quantity
        }
        for i in order.items
    ]
    
    for item in order.items:
        db.delete(item)
    db.delete(order)
    db.commit()
    
    return {
        "status": "ok",
        "message": "Pedido eliminado correctamente",
        "order_number": order_number,
        "restored_items": items_data
    }

@router.delete("/admin/{order_number}")
def delete_order_admin(order_number: str, db: Session = Depends(get_db), current_admin: Admin = Depends(get_current_admin)):
    order = db.query(Order).filter(Order.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    items_data = [
        {
            "product_id": i.product_id,
            "variant_id": i.variant_id,
            "quantity": i.quantity
        }
        for i in order.items
    ]
    
    for item in order.items:
        db.delete(item)
    db.delete(order)
    db.commit()
    
    return {
        "status": "ok",
        "message": "Pedido eliminado por administrador",
        "order_number": order_number,
        "restored_items": items_data
    }
