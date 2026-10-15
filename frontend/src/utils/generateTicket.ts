import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleRecord } from '@/store/useStockStore';
import { COMPANY_DEFAULTS } from '@/config/company';

export function createTicketDoc(ticketId: string, sales: SaleRecord[]): jsPDF | null {
    const ticketSales = sales.filter(s => s.ticketId === ticketId);
    if (ticketSales.length === 0) return null;

    // Thermal printer format (80mm width, auto height depending on content)
    const baseHeight = 90;
    const itemHeight = 15;
    const docHeight = baseHeight + (ticketSales.length * itemHeight);

    const doc = new jsPDF({
        unit: 'mm',
        format: [80, docHeight] 
    });

    const clientName = ticketSales[0].clientName || 'Consumidor Final';
    const clientPhone = ticketSales[0].clientPhone || 'N/A';
    const dateStr = new Date(ticketSales[0].date).toLocaleDateString('es-AR') + ' ' + new Date(ticketSales[0].date).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
    
    const storeTitle = (COMPANY_DEFAULTS?.name || 'CIARA BONITA').toUpperCase();

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(storeTitle, 40, 10, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`TICKET: ${ticketId}`, 40, 16, { align: "center" });
    doc.text(`FECHA: ${dateStr}`, 40, 22, { align: "center" });
    
    doc.line(5, 26, 75, 26);
    
    // Client Info
    doc.setFont("helvetica", "bold");
    doc.text(`Cliente:`, 5, 32);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 20, 32);

    doc.setFont("helvetica", "bold");
    doc.text(`Telefono:`, 5, 38);
    doc.setFont("helvetica", "normal");
    doc.text(clientPhone, 22, 38);
    
    doc.line(5, 42, 75, 42);

    // Items
    const tableData = ticketSales.map(s => [
        `${s.quantity}x ${s.productName}\n${s.color} - Talle ${s.size}`,
        `$${s.revenue.toLocaleString()}`
    ]);

    autoTable(doc, {
        startY: 46,
        head: [['Cant. - Desc.', 'Total']],
        body: tableData,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 20, halign: 'right' }
        },
        margin: { left: 5, right: 5 }
    });

    let currentY = (doc as any).lastAutoTable?.finalY ?? 68;
    // Total
    const total = ticketSales.reduce((acc, s) => acc + s.revenue, 0);
    const firstSale = ticketSales[0];
    const paid = firstSale.paidAmount !== undefined ? firstSale.paidAmount : total;
    const pending = firstSale.pendingAmount !== undefined ? firstSale.pendingAmount : (firstSale.remainingAmount || 0);
    const pType = firstSale.paymentType || 'total';

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: $${total.toLocaleString('es-AR')}`, 75, currentY, { align: "right" });
    currentY += 6;

    if (pType !== 'total' || pending > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const typeLabel = pType === 'cuotas' 
            ? `En ${firstSale.installmentsCount || 1} cuota(s)` 
            : 'Pago Parcial';
        doc.text(`Modalidad: ${typeLabel}`, 5, currentY);
        currentY += 5;
        doc.text(`Abonado hoy: $${paid.toLocaleString('es-AR')}`, 5, currentY);
        currentY += 5;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(200, 0, 0);
        doc.text(`SALDO ADEUDADO: $${pending.toLocaleString('es-AR')}`, 5, currentY);
        doc.setTextColor(0, 0, 0);
        currentY += 7;
    }
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("¡Gracias por su compra!", 40, currentY + 6, { align: "center" });

    return doc;
}

export function generateTicketPDF(ticketId: string, sales: SaleRecord[], print: boolean = true) {
    const doc = createTicketDoc(ticketId, sales);
    if (!doc) return;

    if (print) {
        doc.autoPrint();
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } else {
        doc.save(`${ticketId}.pdf`);
    }
}

