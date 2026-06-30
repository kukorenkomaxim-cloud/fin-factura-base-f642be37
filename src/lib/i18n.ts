// PDF document strings. Documents are always issued in Spanish (the language
// the Spanish tax authority understands). The `Lang` parameter still selects
// labels for the rest of the PDF text (concept/qty/etc.) per UI language, but
// the document type names ("Factura" / "Factura Proforma") are universal.

import type { Lang } from "./format";

const COMMON_NAMES = {
  proforma: "Factura Proforma",
  factura: "Factura",
} as const;

export const PDF_T = {
  ru: {
    ...COMMON_NAMES,
    number: "Номер",
    date: "Дата",
    period: "Период",
    from: "Исполнитель",
    to: "Заказчик",
    concept: "НАИМЕНОВАНИЕ",
    quantity: "КОЛ-ВО",
    price: "ЦЕНА БЕЗ НДС",
    vat: "НДС",
    subtotal: "СУММА БЕЗ НДС",
    base: "База налогообложения",
    vatLine: (rate: number, base: string) => `НДС ${rate}% (${base})`,
    total: "Итого к оплате",
    paymentMethod: "Способ оплаты",
    transfer: "Банковский перевод",
    bankAccount: "Банковские реквизиты",
    bank: "Банк",
    account: "Счёт",
    swift: "SWIFT/BIC",
    page: (a: number, b: number) => `Страница ${a} из ${b}`,
    unit: "ед.",
  },
  en: {
    ...COMMON_NAMES,
    number: "Number",
    date: "Date",
    period: "Period",
    from: "From",
    to: "Bill To",
    concept: "DESCRIPTION",
    quantity: "QTY",
    price: "PRICE EXCL. VAT",
    vat: "VAT",
    subtotal: "SUBTOTAL EXCL. VAT",
    base: "Taxable base",
    vatLine: (rate: number, base: string) => `VAT ${rate}% (${base})`,
    total: "Total due",
    paymentMethod: "Payment method",
    transfer: "Bank transfer",
    bankAccount: "Bank account",
    bank: "Bank",
    account: "Account",
    swift: "SWIFT/BIC",
    page: (a: number, b: number) => `Page ${a} of ${b}`,
    unit: "unit",
  },
  es: {
    ...COMMON_NAMES,
    number: "Número",
    date: "Fecha",
    period: "Periodo",
    from: "Emisor",
    to: "Cliente",
    concept: "CONCEPTO",
    quantity: "CANTIDAD",
    price: "PRECIO S/I",
    vat: "IVA",
    subtotal: "SUBTOTAL S/I",
    base: "Base imponible",
    vatLine: (rate: number, base: string) => `IVA ${rate}% (${base})`,
    total: "Total a pagar",
    paymentMethod: "Método de pago",
    transfer: "Transferencia bancaria",
    bankAccount: "Cuenta bancaria",
    bank: "Banco",
    account: "Cuenta",
    swift: "SWIFT/BIC",
    page: (a: number, b: number) => `Página ${a} de ${b}`,
    unit: "ud.",
  },
} as const satisfies Record<Lang, Record<string, unknown>>;

export type PdfDict = (typeof PDF_T)[Lang];
