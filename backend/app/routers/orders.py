from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from typing import List
from app.models import Customer, Order, OrderItem
from app.dependencies import get_db, get_current_customer

router = APIRouter(prefix="/api/orders", tags=["orders"])

class OrderItemSchema(BaseModel):
    product_id: str
    variant_id: str
    quantity: int
    sale_price: float

class CreateOrderSchema(BaseModel):
    items: List[OrderItemSchema]
    
@router.post("")
def create_order(order_data: CreateOrderSchema, db: Session = Depends(get_db), current_user: Customer = Depends(get_current_customer)):
    if not current_user.email_verified:
        raise HTTPException(status_code=403, detail="Debes verificar tu correo para comprar.")
    
    total = sum(i.quantity * i.sale_price for i in order_data.items)
    order_number = "ORD-" + str(uuid.uuid4())[:8].upper()
    
    new_order = Order(
        user_id=current_user.id,
        order_number=order_number,
        status="Pendiente de pago",
        total=total
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    for item in order_data.items:
        db.add(OrderItem(
            order_id=new_order.id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            price=item.sale_price
        ))
    db.commit()
    
    return {"status": "ok", "order_number": order_number}

@router.get("")
def get_orders(db: Session = Depends(get_db), current_user: Customer = Depends(get_current_customer)):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).all()
    res = []
    for o in orders:
        res.append({
            "order_number": o.order_number,
            "status": o.status,
            "total": o.total,
            "created_at": o.created_at,
            "items": [{"product_id": i.product_id, "quantity": i.quantity} for i in o.items]
        })
    return res
