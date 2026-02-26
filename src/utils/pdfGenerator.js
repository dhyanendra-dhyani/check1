/**
 * ═══════════════════════════════════════════════════════════
 * SUVIDHA Setu - PDF Receipt Generator
 * Uses jsPDF to create payment & complaint receipts
 * ═══════════════════════════════════════════════════════════
 */

import { jsPDF } from 'jspdf';

/**
 * Generate a PDF receipt for a bill payment
 * @param {object} data - Receipt data
 * @param {boolean} isPending - Whether transaction is pending sync
 * @returns {jsPDF} - PDF document instance (can save or download)
 */
export function generatePaymentReceipt(data, isPending = false) {
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header bar
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SUVIDHA Setu', pageWidth / 2, 11, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Smart Civic Kiosk — Payment Receipt', pageWidth / 2, 19, { align: 'center' });

    // Saffron + Green accent line (Indian flag)
    doc.setFillColor(255, 153, 51);
    doc.rect(0, 28, pageWidth / 2, 2, 'F');
    doc.setFillColor(19, 136, 8);
    doc.rect(pageWidth / 2, 28, pageWidth / 2, 2, 'F');

    let y = 38;
    doc.setTextColor(0, 0, 0);

    // Pending sync watermark
    if (isPending) {
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(30);
        doc.setFont('helvetica', 'bold');
        doc.text('PENDING SYNC', pageWidth / 2, 100, {
            align: 'center',
            angle: 45,
            renderingMode: 'stroke',
        });
        doc.setTextColor(0, 0, 0);
    }

    // Transaction Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Transaction Details', 10, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const fields = [
        ['Transaction ID', data.transactionId || 'N/A'],
        ['Date & Time', data.timestamp || new Date().toLocaleString('en-IN')],
        ['Service', data.service || 'Electricity'],
        ['Consumer ID', data.consumerId || 'N/A'],
        ['Consumer Name', data.consumerName || 'N/A'],
        ['Bill Amount', `Rs. ${data.amount || 0}`],
        ['Payment Method', data.paymentMethod || 'Cash'],
        ['Status', isPending ? 'Pending Sync' : 'Confirmed'],
    ];

    for (const [label, value] of fields) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 12, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 55, y);
        y += 7;
    }

    // Separator line
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(10, y, pageWidth - 10, y);
    y += 8;

    // Amount paid (large)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // green
    doc.text(`Amount Paid: Rs. ${data.amount || 0}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Footer
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('This is a computer-generated receipt. No signature required.', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('C-DAC SUVIDHA 2026 — Empowering Citizens Through Technology', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('For issues, contact: support@suvidha.gov.in | Helpline: 1800-XXX-XXXX', pageWidth / 2, y, { align: 'center' });

    return doc;
}

/**
 * Generate a PDF receipt for a complaint
 * @param {object} data - Complaint data
 * @param {boolean} isPending - Whether complaint is pending sync
 * @returns {jsPDF}
 */
export function generateComplaintReceipt(data, isPending = false) {
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header bar
    doc.setFillColor(139, 92, 246); // purple
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SUVIDHA Setu', pageWidth / 2, 11, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Smart Civic Kiosk — Complaint Receipt', pageWidth / 2, 19, { align: 'center' });

    // Accent line
    doc.setFillColor(255, 153, 51);
    doc.rect(0, 28, pageWidth / 2, 2, 'F');
    doc.setFillColor(19, 136, 8);
    doc.rect(pageWidth / 2, 28, pageWidth / 2, 2, 'F');

    let y = 38;
    doc.setTextColor(0, 0, 0);

    if (isPending) {
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(30);
        doc.setFont('helvetica', 'bold');
        doc.text('PENDING SYNC', pageWidth / 2, 100, {
            align: 'center',
            angle: 45,
            renderingMode: 'stroke',
        });
        doc.setTextColor(0, 0, 0);
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Complaint Details', 10, y);
    y += 8;

    doc.setFontSize(10);
    const fields = [
        ['Ticket ID', data.ticketId || 'N/A'],
        ['Date & Time', data.timestamp || new Date().toLocaleString('en-IN')],
        ['Category', data.category || 'N/A'],
        ['Description', data.description || 'N/A'],
        ['Location', data.location || 'N/A'],
        ['Status', isPending ? 'Pending Sync' : 'Submitted'],
    ];

    for (const [label, value] of fields) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 12, y);
        doc.setFont('helvetica', 'normal');
        // Word-wrap long descriptions
        const lines = doc.splitTextToSize(value, pageWidth - 65);
        doc.text(lines, 55, y);
        y += lines.length * 5 + 3;
    }

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(10, y, pageWidth - 10, y);
    y += 8;

    // Status badge
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11); // amber
    doc.text('Status: SUBMITTED', pageWidth / 2, y, { align: 'center' });
    y += 12;

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Track your complaint at: suvidha.gov.in/track', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('C-DAC SUVIDHA 2026 — Empowering Citizens Through Technology', pageWidth / 2, y, { align: 'center' });

    return doc;
}

/**
 * Download a generated PDF receipt
 * @param {jsPDF} doc - PDF document
 * @param {string} filename - Download filename
 */
export function downloadReceipt(doc, filename) {
    doc.save(filename);
}
