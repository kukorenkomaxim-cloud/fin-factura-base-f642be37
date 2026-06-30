// PDF generation for invoices and proformas.
// Visual style follows the user-provided sample (Factura_1-2026-001.pdf):
// - Right-aligned title with number and date
// - Two columns: issuer (left), client (right in soft gray card)
// - Services table with header row, single line item
// - Right gray totals card with base / VAT / total
// - Bottom row: payment method + bank account block
// - Bottom-right page number

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { buildDocNumber, docNumberPrefix, formatDate, formatMoney, type Currency, type Lang } from "./format";
import { PDF_T } from "./i18n";
import { ROBOTO_REGULAR_B64, ROBOTO_BOLD_B64 } from "./fonts";
import { isEuCountry } from "./countries";

function registerRoboto(doc: jsPDF) {
  doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_B64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_B64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
}

const FONT = "Roboto";

export interface PdfDocInput {
  docType: "proforma" | "factura";
  seqNumber: number;
  docMonth: number;
  docYear: number;
  issueDate: string; // ISO date
  language: Lang;
  currency: Currency;

  issuerName: string;
  issuerTaxNumber: string;
  issuerAddressLine1: string;
  issuerAddressLine2: string;

  clientName: string;
  clientTaxNumber: string;
  clientAddressLine1: string;
  clientAddressLine2: string;
  clientCountry: string;

  issuerCountry: string;

  serviceName: string;
  periodStart?: string | null;
  periodEnd?: string | null;

  amountNet: number;
  vatRate: number;
  vatAmount: number;
  amountTotal: number;

  bankName: string;
  bankAccountNumber: string;
  bankSwift: string;

  // Verifactu QR (only for Spanish facturas)
  verifactuQrDataUrl?: string;
  verifactuHash?: string;
  verifactuMode?: "sandbox" | "production";

  // FX equivalence in EUR (for non-EUR invoices, required by AEAT)
  exchangeRate?: number | null;
  exchangeRateDate?: string | null;
  amountNetEur?: number;
  vatAmountEur?: number;
  amountTotalEur?: number;

  // Rectifying invoice (Factura rectificativa) — Spanish facturas
  isRectifying?: boolean;
  rectificationType?: string; // "R1".."R5"
  rectificationMethod?: "I" | "S";
  rectificationReason?: string;
  rectifiedInvoiceNumber?: string;
  rectifiedInvoiceDate?: string; // ISO date

  // Annulled (RegistroAnulacion accepted by AEAT) — render watermark "ANULADA"
  isAnnulled?: boolean;

  // The user-defined document number (new numbering model). When present it is
  // used verbatim for the header, QR "numserie" and filename so it always
  // matches the value the Verifactu hash was computed from.
  formattedNumber?: string;
}

const COLORS = {
  text: [17, 24, 39] as [number, number, number], // slate-900
  muted: [107, 114, 128] as [number, number, number], // gray-500
  cardBg: [243, 244, 246] as [number, number, number], // gray-100
  rule: [229, 231, 235] as [number, number, number], // gray-200
};

export function generateInvoicePdf(input: PdfDocInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerRoboto(doc);
  const t = PDF_T[input.language];

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 18;

  // ---------- HEADER (right-aligned) ----------
  const baseTitle = input.docType === "proforma" ? t.proforma : t.factura;
  const titleText = input.isRectifying
    ? (input.language === "es" ? `${baseTitle} rectificativa` :
       input.language === "ru" ? `Корректирующая ${baseTitle.toLowerCase()}` :
       `Corrective ${baseTitle.toLowerCase()}`)
    : baseTitle;
  const prefix = docNumberPrefix(input.docType, input.language);
  const numericPart = `${pad2(input.docMonth)}-${pad4(input.docYear)}-${pad3(input.seqNumber)}`;
  const fallbackNumber = prefix ? `${prefix} ${numericPart}` : numericPart;
  const numberText = input.formattedNumber?.trim() || fallbackNumber;
  const dateText = formatDate(input.issueDate, input.language);

  doc.setFont(FONT, "bold");
  doc.setFontSize(input.isRectifying ? 22 : 28);
  doc.setTextColor(...COLORS.text);
  doc.text(titleText, pageW - marginX, 25, { align: "right" });

  doc.setFont(FONT, "normal");
  doc.setFontSize(11);
  doc.text(numberText, pageW - marginX - 35, 35, { align: "right" });
  doc.text(dateText, pageW - marginX, 35, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(t.number, pageW - marginX - 35, 40, { align: "right" });
  doc.text(t.date, pageW - marginX, 40, { align: "right" });

  // Rectification info under header (left side, above issuer block)
  if (input.isRectifying && input.rectifiedInvoiceNumber) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    const lbl = input.language === "es" ? "Factura rectificativa" :
                input.language === "ru" ? "Корректирующая фактура" :
                "Corrective invoice";
    const typeMethod = `${lbl} · ${input.rectificationType ?? ""}${input.rectificationMethod ? " / " + (input.rectificationMethod === "S" ? "Sustitución" : "Por diferencias") : ""}`;
    doc.text(typeMethod, marginX, 45);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    const dateStr = input.rectifiedInvoiceDate ? formatDate(input.rectifiedInvoiceDate, input.language) : "";
    const refLbl = input.language === "es" ? "Rectifica a:" :
                   input.language === "ru" ? "Исправляет:" : "Rectifies:";
    doc.text(`${refLbl} ${input.rectifiedInvoiceNumber}${dateStr ? " (" + dateStr + ")" : ""}`, marginX, 50);
    if (input.rectificationReason) {
      const motLbl = input.language === "es" ? "Motivo:" :
                     input.language === "ru" ? "Причина:" : "Reason:";
      doc.text(`${motLbl} ${input.rectificationReason}`, marginX, 55);
    }
  }


  // ---------- ISSUER (left) and CLIENT (right card) ----------
  const blockTop = 60;

  // Issuer (left)
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text(input.issuerName || "—", marginX, blockTop);

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  let yL = blockTop + 6;
  if (input.issuerTaxNumber) {
    doc.text(input.issuerTaxNumber, marginX, yL);
    yL += 5;
  }
  if (input.issuerAddressLine1) {
    doc.text(input.issuerAddressLine1, marginX, yL);
    yL += 5;
  }
  if (input.issuerAddressLine2) {
    doc.text(input.issuerAddressLine2, marginX, yL);
    yL += 5;
  }

  // Client (right card)
  const cardX = pageW / 2 + 2;
  const cardW = pageW - marginX - cardX;
  const cardY = blockTop - 6;
  const cardH = 30;
  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, "F");

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text(input.clientName || "—", cardX + 5, cardY + 7);

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  let yR = cardY + 13;
  if (input.clientTaxNumber) {
    doc.text(input.clientTaxNumber, cardX + 5, yR);
    yR += 5;
  }
  if (input.clientAddressLine1) {
    doc.text(input.clientAddressLine1, cardX + 5, yR);
    yR += 5;
  }
  if (input.clientAddressLine2) {
    doc.text(input.clientAddressLine2, cardX + 5, yR);
    yR += 5;
  }

  // ---------- SERVICES TABLE ----------
  const periodSuffix =
    input.periodStart && input.periodEnd
      ? ` (${formatDate(input.periodStart, input.language)} – ${formatDate(input.periodEnd, input.language)})`
      : "";
  const conceptText = `${input.serviceName}${periodSuffix}`;

  autoTable(doc, {
    startY: 110,
    margin: { left: marginX, right: marginX },
    theme: "plain",
    head: [[t.concept, t.quantity, t.price, t.vat, t.subtotal]],
    body: [
      [
        conceptText,
        `1 ${t.unit}`,
        formatMoney(input.amountNet, input.currency, input.language),
        `${input.vatRate} %`,
        formatMoney(input.amountNet, input.currency, input.language),
      ],
    ],
    headStyles: {
      textColor: COLORS.muted,
      fontStyle: "bold",
      fontSize: 9,
      halign: "right",
      font: "Roboto",
    },
    bodyStyles: {
      textColor: COLORS.text,
      fontSize: 10,
      halign: "right",
      cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
      font: "Roboto",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 70 },
      1: { halign: "right", cellWidth: 25 },
      2: { halign: "right" },
      3: { halign: "right", cellWidth: 18 },
      4: { halign: "right" },
    },
    didDrawCell: (data) => {
      // bottom rule under body row
      if (data.section === "body" && data.column.index === 0) {
        const y = data.cell.y + data.cell.height;
        doc.setDrawColor(...COLORS.rule);
        doc.setLineWidth(0.2);
        doc.line(marginX, y, pageW - marginX, y);
      }
    },
  });

  const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ---------- TOTALS CARD (right) ----------
  const totalsX = pageW / 2 + 2;
  const totalsW = pageW - marginX - totalsX;
  const totalsY = tableEndY + 10;
  const totalsH = 38;

  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(totalsX, totalsY, totalsW, totalsH, 2, 2, "F");

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);

  // Base
  doc.text(t.base, totalsX + 5, totalsY + 8);
  doc.text(
    formatMoney(input.amountNet, input.currency, input.language),
    totalsX + totalsW - 5,
    totalsY + 8,
    { align: "right" },
  );

  // VAT line
  doc.text(
    t.vatLine(input.vatRate, formatMoney(input.amountNet, input.currency, input.language)),
    totalsX + 5,
    totalsY + 15,
  );
  doc.text(
    formatMoney(input.vatAmount, input.currency, input.language),
    totalsX + totalsW - 5,
    totalsY + 15,
    { align: "right" },
  );

  // separator
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.3);
  doc.line(totalsX + 5, totalsY + 19, totalsX + totalsW - 5, totalsY + 19);

  // Total
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.text(
    formatMoney(input.amountTotal, input.currency, input.language),
    totalsX + totalsW - 5,
    totalsY + 30,
    { align: "right" },
  );

  // ---------- EUR EQUIVALENCE (non-EUR invoices) ----------
  let bottomY = totalsY + totalsH + 18;

  if (
    input.currency !== "EUR" &&
    input.exchangeRate &&
    input.amountNetEur != null &&
    input.vatAmountEur != null &&
    input.amountTotalEur != null
  ) {
    const eqY = totalsY + totalsH + 6;
    const eqH = 26;
    doc.setFillColor(...COLORS.cardBg);
    doc.roundedRect(marginX, eqY, pageW - marginX * 2, eqH, 2, 2, "F");

    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Equivalencia en EUR (a efectos fiscales)", marginX + 5, eqY + 6);

    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    const rateInfo = `Tipo de cambio Banco de España (BOE${input.exchangeRateDate ? ` del ${input.exchangeRateDate}` : ""}): 1 ${input.currency} = ${input.exchangeRate.toFixed(6)} EUR`;
    doc.text(rateInfo, marginX + 5, eqY + 11);

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(9);
    const baseStr = `Base: ${formatMoney(input.amountNetEur, "EUR", input.language)}`;
    const vatStr = `IVA (${input.vatRate}%): ${formatMoney(input.vatAmountEur, "EUR", input.language)}`;
    const totStr = `Total: ${formatMoney(input.amountTotalEur, "EUR", input.language)}`;
    doc.text(baseStr, marginX + 5, eqY + 18);
    doc.text(vatStr, marginX + 5 + (pageW - marginX * 2) / 3, eqY + 18);
    doc.setFont(FONT, "bold");
    doc.text(totStr, pageW - marginX - 5, eqY + 18, { align: "right" });

    bottomY = eqY + eqH + 14;
  }

  // ---------- IVA EXEMPT NOTE (Spanish factura, issuer=ES, client outside EU) ----------
  const showIvaExempt =
    input.docType === "factura" &&
    input.language === "es" &&
    input.issuerCountry === "ES" &&
    input.clientCountry !== "" &&
    !isEuCountry(input.clientCountry);


  if (showIvaExempt) {
    const exemptText = "Factura exenta de IVA según el art. 21 de la Ley 37/1992";
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(exemptText, marginX, bottomY - 10);
    bottomY += 4;
  }

  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.3);
  doc.line(marginX, bottomY - 6, pageW - marginX, bottomY - 6);

  const colW = (pageW - marginX * 2) / 2;

  // Payment method
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text(t.paymentMethod, marginX, bottomY);
  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.text(t.transfer, marginX, bottomY + 6);

  // Bank account
  const bankX = marginX + colW;
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.text(t.bankAccount, bankX, bottomY);

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  let by = bottomY + 6;
  if (input.bankName) {
    doc.setFont(FONT, "bold");
    doc.text(t.bank, bankX, by);
    doc.setFont(FONT, "normal");
    doc.text(input.bankName, pageW - marginX, by, { align: "right" });
    by += 5;
  }
  if (input.bankAccountNumber) {
    doc.setFont(FONT, "bold");
    doc.text(t.account, bankX, by);
    doc.setFont(FONT, "normal");
    doc.text(input.bankAccountNumber, pageW - marginX, by, { align: "right" });
    by += 5;
  }
  if (input.bankSwift) {
    doc.setFont(FONT, "bold");
    doc.text(t.swift, bankX, by);
    doc.setFont(FONT, "normal");
    doc.text(input.bankSwift, pageW - marginX, by, { align: "right" });
    by += 5;
  }

  // ---------- VERIFACTU QR CODE (top center, Spanish facturas only) ----------
  if (input.verifactuQrDataUrl && input.docType === "factura" && input.language === "es") {
    const qrSize = 24;
    const qrX = (pageW - qrSize) / 2;
    const qrY = 10;
    doc.addImage(input.verifactuQrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

    let textY = qrY + qrSize + 3;

    // Official Verifactu wordmark — only for real (production) facturas that
    // operate under the Verifactu system. Test/sandbox facturas must not carry
    // the official "VERI*FACTU" legend per AEAT guidance.
    if (input.verifactuMode === "production") {
      doc.setFont(FONT, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      doc.text("VERI*FACTU", pageW / 2, textY, { align: "center" });
      textY += 3.2;
    }

    // Verification legend required next to the QR.
    doc.setFont(FONT, "normal");
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.muted);
    doc.text("Factura verificable en la Sede Electrónica de la AEAT", pageW / 2, textY, {
      align: "center",
    });

    // Hash (huella) helps cross-checking the record.
    if (input.verifactuHash) {
      textY += 2.6;
      doc.setFontSize(5);
      doc.text(`Huella: ${input.verifactuHash.slice(0, 32)}…`, pageW / 2, textY, { align: "center" });
    }
  }

  // ---------- FOOTER ----------
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(t.page(1, 1), pageW - marginX, pageH - 10, { align: "right" });

  // ---------- ANNULLED WATERMARK ----------
  if (input.isAnnulled) {
    doc.saveGraphicsState();
    // jsPDF supports GState opacity via setGState
    const gs = (doc as unknown as { GState: new (o: { opacity: number }) => unknown })
      .GState
      ? new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.18 })
      : null;
    if (gs) (doc as unknown as { setGState: (g: unknown) => void }).setGState(gs);
    doc.setFont(FONT, "bold");
    doc.setFontSize(110);
    doc.setTextColor(220, 38, 38); // red-600
    doc.text("ANULADA", pageW / 2, pageH / 2, { align: "center", angle: 30 });
    doc.restoreGraphicsState();
  }

  return doc;
}

export async function downloadPdf(input: PdfDocInput) {
  const number =
    input.formattedNumber?.trim() ||
    buildDocNumber(input.docType, input.docMonth, input.docYear, input.seqNumber, input.language);
  // Generate QR data URL for Spanish facturas if hash is available
  if (input.docType === "factura" && input.language === "es" && input.verifactuHash && input.issuerTaxNumber) {
    const { buildVerifactuQrUrl, isoToAeatDate } = await import("./verifactu");
    const qrUrl = buildVerifactuQrUrl({
      nif: input.issuerTaxNumber,
      numserie: number,
      fecha: isoToAeatDate(input.issueDate),
      importe: input.currency === "EUR" ? input.amountTotal : (input.amountTotalEur ?? input.amountTotal),
      mode: input.verifactuMode,
    });
    input.verifactuQrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });
  }

  const doc = generateInvoicePdf(input);
  doc.save(`${number}.pdf`);
}

/** Generate the PDF and return { base64, filename } without triggering a download. */
export async function buildPdfBase64(input: PdfDocInput): Promise<{ base64: string; filename: string }> {
  const number =
    input.formattedNumber?.trim() ||
    buildDocNumber(input.docType, input.docMonth, input.docYear, input.seqNumber, input.language);
  if (input.docType === "factura" && input.language === "es" && input.verifactuHash && input.issuerTaxNumber) {
    const { buildVerifactuQrUrl, isoToAeatDate } = await import("./verifactu");
    const qrUrl = buildVerifactuQrUrl({
      nif: input.issuerTaxNumber,
      numserie: number,
      fecha: isoToAeatDate(input.issueDate),
      importe: input.currency === "EUR" ? input.amountTotal : (input.amountTotalEur ?? input.amountTotal),
      mode: input.verifactuMode,
    });
    input.verifactuQrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });
  }
  const doc = generateInvoicePdf(input);
  // jsPDF datauristring: "data:application/pdf;filename=...;base64,XXXX"
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",", 2)[1] ?? "";
  return { base64, filename: `${number}.pdf` };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function pad3(n: number) {
  return String(n).padStart(3, "0");
}
function pad4(n: number) {
  return String(n).padStart(4, "0");
}
