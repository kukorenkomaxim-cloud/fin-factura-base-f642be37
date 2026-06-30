// FX (foreign exchange) helpers for invoices issued in non-EUR currencies.
//
// Spanish AEAT requires VAT amounts to be reported in EUR. The official
// reference rate is the one published by Banco de España in the BOE, which
// matches the ECB reference rate (Banco de España republishes the ECB fix).
//
// IMPORTANT — date handling:
// BOE publishes on day D the rate fixed by Banco de España on day D-1.
// Therefore, for an invoice issued on D, we must use the rate published in
// BOE on D, which is the rate fixed on D-1.
//
// We use the Frankfurter API (free, no key, sourced from ECB).
// `https://api.frankfurter.app/<date>?from=USD&to=EUR`
// If the requested date is a weekend/holiday, Frankfurter returns the rate
// of the most recent prior publishing day, which is exactly what we want.

import type { Currency } from "./format";

export interface FxRate {
  /** EUR amount per 1 unit of the source currency. */
  rate: number;
  /** Date of the rate actually used (DD-MM-YYYY → ISO YYYY-MM-DD). */
  rateDate: string;
  /** Human-readable source label, stored for audit. */
  source: string;
}

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch the EUR-equivalent rate for a non-EUR invoice on its issue date.
 *
 * Per BOE/Banco de España rules, we request the rate dated `issueDate - 1 day`.
 * Frankfurter automatically falls back to the most recent prior publishing day
 * when the requested date is a weekend/holiday.
 */
export async function fetchEuroRate(
  currency: Currency,
  issueDateIso: string,
): Promise<FxRate> {
  if (currency === "EUR") {
    return { rate: 1, rateDate: issueDateIso, source: "EUR" };
  }
  const targetDate = isoDateMinusDays(issueDateIso, 1);
  const url = `https://api.frankfurter.dev/v1/${targetDate}?base=${currency}&symbols=EUR`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo obtener el tipo de cambio (${res.status})`);
  }
  const json = (await res.json()) as { date: string; rates: Record<string, number> };
  const rate = json?.rates?.EUR;
  if (!rate || !json.date) {
    throw new Error("Respuesta de tipo de cambio inválida");
  }
  return {
    rate,
    rateDate: json.date,
    source: `Banco de España / BCE (publicado en BOE) – ${json.date}`,
  };
}

export function convertToEur(amount: number, rate: number): number {
  return +(amount * rate).toFixed(2);
}
