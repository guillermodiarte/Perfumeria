import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleRecord } from '@/store/useStockStore';

// ─── Paleta de colores Ciara Bonita ───────────────────────────────────────
const PINK_HEADER: [number, number, number] = [242, 157, 185];   // cabecera de tabla
const PINK_BORDER: [number, number, number] = [245, 175, 200];   // bordes de tabla
const PINK_DOT:   [number, number, number] = [248, 186, 208];    // puntos decorativos
const TEXT_DARK:  [number, number, number] = [25,  25,  25];
const TEXT_GRAY:  [number, number, number] = [90,  90,  90];

// ─── Cargar el logo como base64 desde /public ─────────────────────────────
async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo-ciara-bonita.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Puntos decorativos (cuadrícula de círculos) ──────────────────────────
function drawDots(
  doc: jsPDF,
  startX: number,
  startY: number,
  cols: number,
  rows: number,
  spacing: number,
  radius: number
) {
  doc.setFillColor(...PINK_DOT);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      doc.circle(startX + c * spacing, startY + r * spacing, radius, 'F');
    }
  }
}

// ─── Generador principal ───────────────────────────────────────────────────
export async function createInvoiceDoc(
  ticketId: string,
  sales: SaleRecord[]
): Promise<jsPDF | null> {
  const ticketSales = sales.filter(s => s.ticketId === ticketId);
  if (ticketSales.length === 0) return null;

  const firstSale    = ticketSales[0];
  const shippingCost = firstSale?.shippingCost || 0;

  // ── Documento A4 ──────────────────────────────────────────────────────
  const doc      = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW    = 210;
  const pageH    = 297;
  const marginL  = 15;
  const marginR  = 15;
  const contentW = pageW - marginL - marginR;

  // Cargar logo
  const logoBase64 = await loadLogoBase64();

  // ══════════════════════════════════════════════════════════════════════
  //  ENCABEZADO
  // ══════════════════════════════════════════════════════════════════════

  // Puntos decorativos — esquina superior izquierda
  drawDots(doc, 18, 10, 6, 3, 5.5, 1.3);

  // Logo — esquina superior derecha
  const logoSize = 52;
  if (logoBase64) {
    doc.addImage(
      logoBase64,
      'PNG',
      pageW - marginR - logoSize,
      8,
      logoSize,
      logoSize
    );
  } else {
    // Fallback texto si el logo no cargó
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 50, 110);
    doc.text('Ciara Bonita', pageW - marginR, 28, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    doc.text('perfumería y cosméticos', pageW - marginR, 34, { align: 'right' });
  }

  // "FACTURA" — izquierda
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('FACTURA', marginL, 36);

  // Número y fecha
  const dateObj = new Date(firstSale.date);
  const dateStr = dateObj.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_GRAY);
  doc.text(`N-${ticketId}`, marginL, 44);
  doc.text(dateStr, marginL, 50);

  // ══════════════════════════════════════════════════════════════════════
  //  DATOS DEL CLIENTE
  // ══════════════════════════════════════════════════════════════════════
  const clientName  = (firstSale.clientName || 'Consumidor Final').toUpperCase();
  const clientPhone = firstSale.clientPhone || 'S/D';
  const rawType     = (firstSale as any).clientType || '';
  const clientType  =
    rawType === 'wholesale' || rawType === 'special_wholesale'
      ? 'Mayorista.'
      : 'Minorista.';

  let y = 68;
  const labelX  = marginL + 8;
  const valueX  = marginL + 32;
  const lineEnd = pageW - marginR;

  const clientRow = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    doc.text(label, labelX, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_DARK);
    doc.text(value, valueX, y);

    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(valueX - 1, y + 1.5, lineEnd, y + 1.5);
    y += 9;
  };

  clientRow('Nombre:', clientName);
  clientRow('Teléfono:', clientPhone);
  clientRow('Compra:', clientType);
  y += 4;

  // ══════════════════════════════════════════════════════════════════════
  //  TABLA DE PRODUCTOS
  // ══════════════════════════════════════════════════════════════════════
  const itemsTotal = ticketSales.reduce((acc, s) => acc + (s.revenue || 0), 0);
  const total      = itemsTotal + shippingCost;
  const paid       = firstSale.paidAmount   !== undefined ? Number(firstSale.paidAmount)   : total;
  const pending    = firstSale.pendingAmount !== undefined ? Number(firstSale.pendingAmount) : (firstSale.remainingAmount || 0);
  const pType      = firstSale.paymentType  || 'total';

  const tableBody: (string | number)[][] = ticketSales.map(s => {
    const variant   = [s.color, s.size ? `Talle ${s.size}` : ''].filter(Boolean).join(' — ');
    const productDesc = variant ? `${s.productName}\n${variant}` : s.productName;
    return [
      s.quantity,
      productDesc,
      `$${Number(s.unitSalePrice).toLocaleString('es-AR')} c/u`,
      `$${Number(s.revenue).toLocaleString('es-AR')}`,
    ];
  });

  // Fila de envío si corresponde
  if (shippingCost > 0) {
    tableBody.push([
      1,
      'Envío / Despacho\n(a cargo del comprador)',
      `$${shippingCost.toLocaleString('es-AR')}`,
      `$${shippingCost.toLocaleString('es-AR')}`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['UNIDAD', 'PRODUCTOS', 'PRECIO UNITARIO', 'TOTAL']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: PINK_HEADER,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: TEXT_DARK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: PINK_BORDER,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: contentW - 18 - 42 - 32 },
      2: { halign: 'center', cellWidth: 42 },
      3: { halign: 'center', cellWidth: 32 },
    },
    margin: { left: marginL, right: marginR },
    tableWidth: contentW,
    // Borde exterior de la tabla en rosa
    didDrawPage: (_data: any) => {
      // noop — border drawn by grid theme
    },
  });

  let afterY = ((doc as any).lastAutoTable?.finalY ?? y + 30) + 8;

  // ══════════════════════════════════════════════════════════════════════
  //  TOTALES
  // ══════════════════════════════════════════════════════════════════════
  const totalX = pageW - marginR;

  // Subtotal mercadería (solo si hay envío)
  if (shippingCost > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    doc.text(
      `Subtotal mercadería: $${itemsTotal.toLocaleString('es-AR')}`,
      totalX, afterY, { align: 'right' }
    );
    afterY += 5;

    doc.setTextColor(180, 80, 0);
    doc.text(
      `Envío (a cargo del comprador): $${shippingCost.toLocaleString('es-AR')}`,
      totalX, afterY, { align: 'right' }
    );
    doc.setTextColor(...TEXT_DARK);
    afterY += 5;
  }

  // Línea antes del total
  doc.setDrawColor(...TEXT_DARK);
  doc.setLineWidth(0.4);
  doc.line(totalX - 68, afterY, totalX, afterY);
  afterY += 6;

  // TOTAL
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('TOTAL:', totalX - 36, afterY, { align: 'right' });
  doc.text(`$${total.toLocaleString('es-AR')}`, totalX, afterY, { align: 'right' });

  afterY += 2;
  doc.setLineWidth(0.5);
  doc.line(totalX - 68, afterY, totalX, afterY);
  afterY += 10;

  // ─── Detalles de pago parcial / cuotas ─────────────────────────────
  if (pType !== 'total' || pending > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);

    const modeLabel =
      pType === 'cuotas'
        ? `Modalidad: En ${firstSale.installmentsCount || 1} cuota(s)`
        : 'Modalidad: Pago Parcial';
    doc.text(modeLabel, marginL, afterY);
    afterY += 5;
    doc.text(`Abonado hoy: $${paid.toLocaleString('es-AR')}`, marginL, afterY);
    afterY += 5;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text(`SALDO ADEUDADO: $${pending.toLocaleString('es-AR')}`, marginL, afterY);
    doc.setTextColor(...TEXT_DARK);
    afterY += 10;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PIE DE PÁGINA
  // ══════════════════════════════════════════════════════════════════════
  const footerY = pageH - 22;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_GRAY);
  doc.text('Ciara Bonita perfumería y cosméticos.', marginL, footerY);
  doc.text('\u24D8  ciarabonita_26', marginL, footerY + 5);
  doc.text('www.ciarabonita.com', marginL, footerY + 10);

  // Puntos decorativos — esquina inferior derecha
  drawDots(doc, pageW - 43, footerY - 2, 6, 3, 5.5, 1.3);

  // Línea separadora de pie de página
  doc.setDrawColor(...PINK_BORDER);
  doc.setLineWidth(0.4);
  doc.line(marginL, footerY - 5, pageW - marginR, footerY - 5);

  return doc;
}

// ─── Función pública ──────────────────────────────────────────────────────
export async function generateTicketPDF(
  ticketId: string,
  sales: SaleRecord[],
  print: boolean = true
): Promise<void> {
  const doc = await createInvoiceDoc(ticketId, sales);
  if (!doc) return;

  if (print) {
    doc.autoPrint();
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } else {
    doc.save(`Factura-${ticketId}.pdf`);
  }
}

// Alias para compatibilidad hacia atrás
export const createTicketDoc = createInvoiceDoc;
