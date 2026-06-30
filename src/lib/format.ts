// Currency / number formatting helpers shared across UI and PDF generation.

export type Currency = "EUR" | "USD" | "RUB";
export type Lang = "ru" | "en" | "es";

const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  RUB: "₽",
};

const LOCALE: Record<Lang, string> = {
  ru: "ru-RU",
  en: "en-US",
  es: "es-ES",
};

export function formatMoney(amount: number, currency: Currency, lang: Lang = "es"): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const num = new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${num} ${CURRENCY_SYMBOL[currency]}`;
}

export function formatDate(date: string | Date, lang: Lang = "es"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

// Letter prefix in document number. Documents are always Spanish:
// Proforma → "FP" (Factura Proforma), Factura → no prefix (rendered as "Factura …").
export function docNumberPrefix(
  docType: "proforma" | "factura",
  _lang?: Lang | string,
): string {
  return docType === "proforma" ? "FP" : "";
}

// First three letters of the Spanish month name (lowercase, no accents).
// Index 0 unused so month number maps directly.
const SPANISH_MONTH_ABBR = [
  "", "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function spanishMonthAbbr(month: number): string {
  return SPANISH_MONTH_ABBR[month] ?? pad(month, 2);
}

// Quarter number (1-4) for a given month (1-12).
export function quarterOfMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

export function buildDocNumber(
  docType: "proforma" | "factura",
  month: number,
  year: number,
  seq: number,
  lang: Lang | string = "es",
): string {
  const numeric = `${quarterOfMonth(month)}-${pad(year, 4)}-${pad(seq, 3)}`;
  const prefix = docNumberPrefix(docType, lang);
  return prefix ? `${prefix} ${numeric}` : `Factura ${numeric}`;
}
