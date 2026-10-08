export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, arePhonesEqual, areDnisEqual } from '@/lib/customerValidation';

// PUT /api/admin/users/[id] - Editar cliente
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado. Iniciá sesión como administrador.' }, { status: 401 });

  try {
    const customerId = parseInt(params.id);
    if (isNaN(customerId)) {
      return NextResponse.json({ detail: 'ID de cliente inválido.' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ detail: 'Cliente no encontrado.' }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      dni,
      address,
      province,
      city,
      postal_code,
      customer_type,
      is_wholesale,
      is_special_wholesale,
      password,
    } = body;

    // 1. Validar nombre
    if (!name || !name.trim()) {
      return NextResponse.json({ detail: 'Por favor ingresá el nombre completo del cliente.' }, { status: 400 });
    }

    // 2. Validar email
    if (!email || !email.trim()) {
      return NextResponse.json({ detail: 'Por favor ingresá un correo electrónico.' }, { status: 400 });
    }
    const cleanEmail = normalizeEmail(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ detail: 'El formato del correo electrónico no es válido (ejemplo: usuario@correo.com).' }, { status: 400 });
    }

    // 3. Validar teléfono
    const cleanPhone = phone ? phone.trim() : '';
    if (!cleanPhone) {
      return NextResponse.json({ detail: 'Por favor ingresá un número de teléfono o WhatsApp.' }, { status: 400 });
    }

    // 4. Verificar duplicados contra otros clientes (excluyendo el cliente actual)
    const otherCustomers = await prisma.customer.findMany({
      where: { id: { not: customerId } },
      select: { id: true, name: true, email: true, phone: true, dni: true },
    });

    const dupEmail = otherCustomers.find(c => normalizeEmail(c.email) === cleanEmail);
    if (dupEmail) {
      return NextResponse.json({
        detail: `Ya existe otro cliente ("${dupEmail.name}") registrado con el correo "${cleanEmail}". Usá un correo diferente.`
      }, { status: 400 });
    }

    const dupPhone = otherCustomers.find(c => arePhonesEqual(c.phone, cleanPhone));
    if (dupPhone) {
      return NextResponse.json({
        detail: `Ya existe otro cliente ("${dupPhone.name}") registrado con el teléfono "${dupPhone.phone || cleanPhone}". Usá un número diferente.`
      }, { status: 400 });
    }

    const cleanDni = dni ? dni.trim() : null;
    if (cleanDni) {
      const dupDni = otherCustomers.find(c => areDnisEqual(c.dni, cleanDni));
      if (dupDni) {
        return NextResponse.json({
          detail: `Ya existe otro cliente ("${dupDni.name}") registrado con el DNI "${dupDni.dni || cleanDni}". Verificá el número ingresado.`
        }, { status: 400 });
      }
    }

    const effectiveType = customer_type || (is_special_wholesale ? 'special_wholesale' : is_wholesale ? 'wholesale' : 'normal');
    const isWholesaleFinal = effectiveType === 'wholesale' || effectiveType === 'special_wholesale' || Boolean(is_wholesale);
    const isSpecialFinal = effectiveType === 'special_wholesale' || Boolean(is_special_wholesale);

    const updateData: any = {
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      dni: cleanDni,
      address: address?.trim() || null,
      province: province?.trim() || null,
      city: city?.trim() || null,
      postal_code: postal_code?.trim() || null,
      customer_type: effectiveType,
      is_wholesale: isWholesaleFinal,
      is_special_wholesale: isSpecialFinal,
    };

    if (password && password.trim()) {
      updateData.password_hash = hashPassword(password.trim());
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      dni: updated.dni,
      address: updated.address,
      province: updated.province,
      city: updated.city,
      postal_code: updated.postal_code,
      customer_type: updated.customer_type,
      is_wholesale: updated.is_wholesale,
      is_special_wholesale: updated.is_special_wholesale,
      is_approved: updated.is_approved,
    });
  } catch (error: any) {
    console.error('❌ Error al actualizar cliente:', error);
    return NextResponse.json({ detail: `Error al actualizar cliente: ${error?.message || 'Error desconocido'}` }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const customerId = parseInt(params.id);
    await prisma.customer.delete({ where: { id: customerId } });
    return NextResponse.json({ status: 'deleted' });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error eliminando cliente' }, { status: 500 });
  }
}
