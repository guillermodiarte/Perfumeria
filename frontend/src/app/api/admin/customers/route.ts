export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin, hashPassword } from '@/lib/auth';
import { normalizeEmail, arePhonesEqual, areDnisEqual } from '@/lib/customerValidation';

function formatDatabaseError(error: any): { friendly: string; technical: string } {
  const rawMessage = String(error?.message || error || '');
  const technical = rawMessage;
  const msg = rawMessage.toLowerCase();

  // Violación de restricción única de Prisma (código P2002)
  if (error?.code === 'P2002') {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(', ')
      : String(error.meta?.target || '');

    if (target.includes('email')) {
      return { friendly: 'Ya existe un cliente registrado con este correo electrónico.', technical };
    }
    if (target.includes('phone')) {
      return { friendly: 'Ya existe un cliente registrado con este número de teléfono / WhatsApp.', technical };
    }
    if (target.includes('dni')) {
      return { friendly: 'Ya existe un cliente registrado con este número de DNI / Identificación.', technical };
    }
    return { friendly: `Ya existe un registro duplicado en la base de datos (campo: ${target || 'desconocido'}).`, technical };
  }

  // SQLite unique constraint
  if (msg.includes('unique constraint failed: customers.email') || msg.includes('customers_email_key')) {
    return { friendly: 'Ya existe un cliente registrado con este correo electrónico.', technical };
  }
  if (msg.includes('unique constraint failed: customers.phone') || msg.includes('customers_phone_key')) {
    return { friendly: 'Ya existe un cliente registrado con este número de teléfono / WhatsApp.', technical };
  }
  if (msg.includes('unique constraint failed: customers.dni')) {
    return { friendly: 'Ya existe un cliente registrado con este número de DNI.', technical };
  }
  if (msg.includes('unique constraint failed')) {
    return { friendly: `Dato duplicado: ya existe otro cliente con estos valores. Detalle técnico: ${rawMessage}`, technical };
  }

  // Columna faltante (schema desactualizado)
  if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('no such column'))) {
    const colMatch = rawMessage.match(/column[:\s'"` + "`" + `]*([^\s'"` + "`" + `]+)/i);
    const col = colMatch ? colMatch[1] : 'desconocida';
    return {
      friendly: `Error de esquema: la columna "${col}" no existe en la base de datos. Reiniciá el servidor (Ctrl+C y npm run dev) para aplicar las migraciones pendientes.`,
      technical
    };
  }

  // Valor requerido faltante
  if (msg.includes('not null') || msg.includes('null value')) {
    return { friendly: `Un campo obligatorio está vacío. Detalle: ${rawMessage}`, technical };
  }

  // Error de tipo de dato
  if (msg.includes('invalid') || msg.includes('malformed')) {
    return { friendly: `Valor inválido en uno de los campos. Detalle: ${rawMessage}`, technical };
  }

  return {
    friendly: `Error al guardar el cliente en la base de datos. Detalle: ${rawMessage}`,
    technical
  };
}

// POST /api/admin/customers
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'Acceso no autorizado. Iniciá sesión como administrador.' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      email,
      password,
      name,
      phone,
      dni,
      address,
      province,
      city,
      postal_code,
      customer_type,
      is_wholesale,
      is_special_wholesale
    } = body;

    // 1. Validar Nombre
    if (!name || !name.trim()) {
      return NextResponse.json({ detail: 'Por favor ingresá el nombre completo del cliente.' }, { status: 400 });
    }

    // 2. Validar Email
    if (!email || !email.trim()) {
      return NextResponse.json({ detail: 'Por favor ingresá un correo electrónico para el cliente.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ detail: 'El formato del correo electrónico no es válido (ejemplo: usuario@correo.com).' }, { status: 400 });
    }

    // 3. Validar Teléfono (Obligatorio)
    const cleanPhone = phone ? phone.trim() : '';
    if (!cleanPhone) {
      return NextResponse.json({ detail: 'Por favor ingresá un número de teléfono o WhatsApp para el cliente.' }, { status: 400 });
    }

    // Obtener todos los clientes existentes para verificar duplicados normalizados
    const existingCustomers = await prisma.customer.findMany({
      select: { id: true, name: true, email: true, phone: true, dni: true },
    });

    // 4. Verificar si el email ya existe
    const duplicateEmail = existingCustomers.find(
      c => normalizeEmail(c.email) === cleanEmail
    );
    if (duplicateEmail) {
      return NextResponse.json({
        detail: `Ya existe el cliente "${duplicateEmail.name}" registrado con el correo "${cleanEmail}". Usá un correo diferente o editá el cliente existente.`
      }, { status: 400 });
    }

    // 5. Verificar si el teléfono ya existe (detecta con 0, +54, espacios, etc.)
    const duplicatePhone = existingCustomers.find(
      c => arePhonesEqual(c.phone, cleanPhone)
    );
    if (duplicatePhone) {
      return NextResponse.json({
        detail: `Ya existe el cliente "${duplicatePhone.name}" registrado con el teléfono "${duplicatePhone.phone || cleanPhone}". Usá un número diferente o editá el cliente existente.`
      }, { status: 400 });
    }

    // 6. Verificar DNI si fue proporcionado (detecta con puntos, guiones o espacios)
    const cleanDni = dni ? dni.trim() : null;
    if (cleanDni) {
      const duplicateDni = existingCustomers.find(
        c => areDnisEqual(c.dni, cleanDni)
      );
      if (duplicateDni) {
        return NextResponse.json({
          detail: `Ya existe el cliente "${duplicateDni.name}" registrado con el DNI "${duplicateDni.dni || cleanDni}". Verificá el número ingresado.`
        }, { status: 400 });
      }
    }

    const effectiveType = customer_type || (is_special_wholesale ? 'special_wholesale' : is_wholesale ? 'wholesale' : 'normal');
    const isWholesaleFinal = effectiveType === 'wholesale' || effectiveType === 'special_wholesale' || Boolean(is_wholesale);
    const isSpecialFinal = effectiveType === 'special_wholesale' || Boolean(is_special_wholesale);

    const initialPassword = password?.trim() || 'perfumeria123';

    const newCustomer = await prisma.customer.create({
      data: {
        email: cleanEmail,
        password_hash: hashPassword(initialPassword),
        name: name.trim(),
        phone: cleanPhone,
        dni: cleanDni,
        address: address?.trim() || null,
        province: province?.trim() || null,
        city: city?.trim() || null,
        postal_code: postal_code?.trim() || null,
        customer_type: effectiveType,
        is_wholesale: isWholesaleFinal,
        is_special_wholesale: isSpecialFinal,
        email_verified: true,
        is_approved: true,
      },
    });

    return NextResponse.json({
      id: newCustomer.id,
      email: newCustomer.email,
      name: newCustomer.name,
      phone: newCustomer.phone,
      dni: newCustomer.dni,
      customer_type: newCustomer.customer_type,
      is_wholesale: newCustomer.is_wholesale,
      is_special_wholesale: newCustomer.is_special_wholesale,
      is_approved: newCustomer.is_approved,
    });
  } catch (error: any) {
    console.error('❌ Error al crear cliente desde admin:', error);
    const { friendly, technical } = formatDatabaseError(error);
    return NextResponse.json({ detail: friendly, technical }, { status: 500 });
  }
}
