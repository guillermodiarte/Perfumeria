import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleRecord } from '@/store/useStockStore';

export function generateTicketPDF(ticketId: string, sales: SaleRecord[], print: boolean = true) {
    const ticketSales = sales.filter(s => s.ticketId === ticketId);
    if (ticketSales.length === 0) return;

    // Thermal printer format (80mm width, auto height depending on content but we set a big enough max, or just standard 80x200)
    // We will calculate a dynamic height based on the number of items
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
    
    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("STOCKFLOW", 40, 10, { align: "center" });
    
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

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Total
    const total = ticketSales.reduce((acc, s) => acc + s.revenue, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL A PAGAR: $${total.toLocaleString()}`, 75, finalY, { align: "right" });
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("¡Gracias por su compra!", 40, finalY + 15, { align: "center" });

    if (print) {
        doc.autoPrint();
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } else {
        doc.save(`${ticketId}.pdf`);
    }
}
