// Verifactu utilities: SHA-256 hash chain and QR code URL generation.
//
// Hash chain: Each Spanish factura stores a SHA-256 hash of key fields concatenated
// together with the hash of the previous factura, forming an immutable chain.
//
// QR URL: AEAT provides a verification URL that encodes NIF, invoice number,
// amount, and hash for end-user verification.

import type { Currency } from "./format";

/**
 * Fields used to compute the Verifactu SHA-256 hash for a factura.
 * These match the AEAT specification for RegistroFacturacion.
 */
export interface VerifactuHashInput {
  nifEmisor: string;         // issuer NIF / tax number
  numSerieFactura: string;   // formatted invoice number
  fechaExpedicion: string;   // issue date DD-MM-YYYY
  tipoFactura: string;       // "F1" for normal factura
  cuotaTotal: number;        // VAT amount
  importeTotal: number;      // total amount
  huellaPrevious: string;    // hash of the previous record (empty string for first)
  fechaHoraHuella: string;   // ISO timestamp of hash generation
}

export function normalizeSpanishNifForAeat(value: string): string {
  const compact = (value || "").toUpperCase().replace(/[\s.\-]/g, "");
  return compact.startsWith("ES") ? compact.slice(2) : compact;
}

export function formatAeatDateTimeWithTimezone(
  date = new Date(),
  timeZone = "Europe/Madrid",
): string {
  const wholeSecondDate = new Date(Math.floor(date.getTime() / 1000) * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(wholeSecondDate)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMinutes = Math.round((zonedAsUtc - wholeSecondDate.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMins = String(absOffset % 60).padStart(2, "0");

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${offsetHours}:${offsetMins}`;
}

export function normalizeAeatDateTimeForAeat(value: string): string {
  return value.replace(/\.\d{1,9}(?=(Z|[+-]\d{2}:?\d{2})$)/, "").replace(/Z$/, "+00:00");
}

/**
 * Compute a SHA-256 hash of the Verifactu record fields.
 * Uses the Web Crypto API (works in browser and Cloudflare Workers).
 */
export async function computeVerifactuHash(input: VerifactuHashInput): Promise<string> {
  // AEAT spec: SHA-256 over the string "Key=Value&Key=Value&..." in this exact field order,
  // uppercase hex result. Reference: AEAT error message echoes the exact input string.
  const payload =
    `IDEmisorFactura=${normalizeSpanishNifForAeat(input.nifEmisor)}` +
    `&NumSerieFactura=${input.numSerieFactura}` +
    `&FechaExpedicionFactura=${input.fechaExpedicion}` +
    `&TipoFactura=${input.tipoFactura}` +
    `&CuotaTotal=${formatDecimal(input.cuotaTotal)}` +
    `&ImporteTotal=${formatDecimal(input.importeTotal)}` +
    `&Huella=${input.huellaPrevious}` +
    `&FechaHoraHusoGenRegistro=${input.fechaHoraHuella}`;
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return bufferToHex(hashBuffer).toUpperCase();
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatDecimal(n: number): string {
  return n.toFixed(2);
}

/**
 * Build the AEAT Verifactu verification QR URL.
 * This URL allows anyone to verify the invoice on AEAT's website.
 */
export function buildVerifactuQrUrl(params: {
  nif: string;
  numserie: string;
  fecha: string;       // DD-MM-YYYY
  importe: number;
  mode?: "sandbox" | "production";
}): string {
  // Production: AEAT live validator; sandbox: AEAT pre-production validator.
  const base =
    params.mode === "production"
      ? "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR"
      : "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR";
  const qs = new URLSearchParams({
    nif: normalizeSpanishNifForAeat(params.nif),
    numserie: params.numserie,
    fecha: params.fecha,
    importe: params.importe.toFixed(2),
  });
  return `${base}?${qs.toString()}`;
}

/**
 * Convert ISO date (YYYY-MM-DD) to AEAT format (DD-MM-YYYY).
 */
export function isoToAeatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

/**
 * Fetch the previous factura hash for the current user's hash chain.
 * Returns empty string if no previous factura exists.
 */
export async function fetchPreviousHash(
  supabaseClient: { from: (table: string) => any },
  userId: string,
): Promise<string> {
  const { data } = await supabaseClient
    .from("documents")
    .select("verifactu_hash")
    .eq("user_id", userId)
    .eq("doc_type", "factura")
    .neq("verifactu_hash", "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.verifactu_hash ?? "";
}

/**
 * Fields used to compute the SHA-256 hash for a RegistroAnulacion.
 * Per AEAT spec the field order differs from RegistroAlta.
 */
export interface VerifactuAnulacionHashInput {
  nifEmisor: string;
  numSerieFactura: string;
  fechaExpedicion: string; // DD-MM-YYYY
  huellaPrevious: string;
  fechaHoraHuella: string;
}

export async function computeVerifactuAnulacionHash(
  input: VerifactuAnulacionHashInput,
): Promise<string> {
  const payload =
    `IDEmisorFacturaAnulada=${normalizeSpanishNifForAeat(input.nifEmisor)}` +
    `&NumSerieFacturaAnulada=${input.numSerieFactura}` +
    `&FechaExpedicionFacturaAnulada=${input.fechaExpedicion}` +
    `&Huella=${input.huellaPrevious}` +
    `&FechaHoraHusoGenRegistro=${input.fechaHoraHuella}`;
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return bufferToHex(hashBuffer).toUpperCase();
}

/**
 * Interpret the AEAT response XML for a RegistroAlta submission.
 *
 * AEAT returns EstadoEnvio = "Incorrecto" with EstadoRegistro = "Incorrecto"
 * and CodigoErrorRegistro = 3000 ("Registro de facturación duplicado.") when
 * the same invoice has already been registered. In that case the response
 * also contains a RegistroDuplicado block with EstadoRegistroDuplicado:
 * if it equals "Correcta" the original registration was successful and the
 * invoice is already on file at AEAT — we must treat it as accepted.
 */
export interface AeatAltaInterpretation {
  accepted: boolean;
  estadoEnvio: string;
  estadoRegistro: string;
  csv: string;
  errorCode: string;
  errorMessage: string;
  duplicateOf?: { peticionId: string; estado: string };
}

function pickTag(xml: string, localName: string): string {
  const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9]+:)?${localName}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

export function interpretAeatAltaResponseXml(responseXml: string): AeatAltaInterpretation {
  const xml = responseXml || "";
  const estadoEnvio = pickTag(xml, "EstadoEnvio");
  const estadoRegistro = pickTag(xml, "EstadoRegistro");
  const csv = pickTag(xml, "CSV");
  const errorCode = pickTag(xml, "CodigoErrorRegistro");
  const errorMessage = pickTag(xml, "DescripcionErrorRegistro");
  const dupBlock = (xml.match(/<(?:[A-Za-z0-9]+:)?RegistroDuplicado\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9]+:)?RegistroDuplicado>/) || [""])[0];
  const duplicate = dupBlock
    ? {
        peticionId: pickTag(dupBlock, "IdPeticionRegistroDuplicado"),
        estado: pickTag(dupBlock, "EstadoRegistroDuplicado"),
      }
    : undefined;
  const acceptedDirect = estadoEnvio.toLowerCase() === "correcto" || estadoRegistro.toLowerCase() === "correcto";
  const acceptedViaDuplicate = !!duplicate && duplicate.estado.toLowerCase() === "correcta";
  return {
    accepted: acceptedDirect || acceptedViaDuplicate,
    estadoEnvio,
    estadoRegistro,
    csv,
    errorCode,
    errorMessage,
    duplicateOf: acceptedViaDuplicate ? duplicate : undefined,
  };
}

/**
 * Interpret the AEAT response XML for a RegistroAnulacion submission.
 *
 * Mirrors interpretAeatAltaResponseXml: if AEAT reports the annulment as a
 * duplicate of a previously-accepted annulment (EstadoRegistroDuplicado =
 * "Correcta"), we treat the submission as accepted. This makes safe retries
 * possible after a lost network response.
 */
export function interpretAeatAnulacionResponseXml(
  responseXml: string,
): AeatAltaInterpretation {
  // Reuse the same shape — anulacion responses use the same EstadoEnvio /
  // EstadoRegistro / RegistroDuplicado tags as alta responses.
  return interpretAeatAltaResponseXml(responseXml);
}

