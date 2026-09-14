import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma, ensureDbSchema } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';

// POST /api/admin/orders/[orderNumber]/ship
export async function POST(req: NextRequest, { params }: { params: { orderNumber: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    await ensureDbSchema();
    const { orderNumber } = params;
    const formData = await req.formData();
    const trackingNumber = (formData.get('tracking_number') as string) || '';
    const file = formData.get('invoice_file') as File | null;

    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
    });

    if (!order) {
      return NextResponse.json({ detail: 'Pedido no encontrado' }, { status: 404 });
    }

    let invoiceUrl: string | undefined = undefined;
    if (file && file.size > 0) {
      const uploadDir = getUploadDir();
      const destDir = path.join(uploadDir, 'Facturas');
      fs.mkdirSync(destDir, { recursive: true });

      const timestamp = Date.now();
      const safeName = file.name.replace(/\.\./g, '').replace(/[\/\\]/g, '');
      const fileName = `${timestamp}_${safeName}`;
      const filePath = path.join(destDir, fileName);

      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      invoiceUrl = `/uploads/Facturas/${fileName}`;
    }

    const updated = await prisma.order.update({
      where: { order_number: orderNumber },
      data: {
        delivery_status: 'shipped',
        shipped_at: new Date().toISOString(),
        ...(trackingNumber ? { shipping_tracking_number: trackingNumber } : {}),
        ...(invoiceUrl ? { shipping_invoice_url: invoiceUrl } : {}),
      },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('Error in order ship route:', error);
    return NextResponse.json({ detail: error.message || 'Error al procesar envío' }, { status: 500 });
  }
}
