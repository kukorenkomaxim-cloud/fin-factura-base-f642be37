// AEAT Verifactu XML generation for RegistroAlta (invoice registration).
//
// Generates SOAP 1.1 XML compliant with the AEAT SuministroLR.xsd schema
// for voluntary submission (VERI*FACTU) to the test environment.
//
// Reference: https://sede.agenciatributaria.gob.es/.../Veri-Factu_Descripcion_SWeb.pdf

import { normalizeAeatDateTimeForAeat, normalizeSpanishNifForAeat } from "./verifactu";

const NS_SOAPENV = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_SUM =
  "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
const NS_SUM1 =
  "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";

/** Software information block – identifies this invoicing system */
const SIF = {
  nombreRazon: "Lovable Invoices",
  nombreSistemaInformatico: "Lovable Invoices",
  idSistemaInformatico: "L1",
  version: "1.0.0",
  numeroInstalacion: "001",
  tipoUsoPosibleSoloVerifactu: "S",
  tipoUsoPosibleMultiOT: "N",
  indicadorMultiplesOT: "N",
};

export interface VerifactuXmlInput {
  // Issuer
  issuerName: string;
  issuerNif: string;

  // Invoice identification
  invoiceNumber: string; // formatted number e.g. "Factura 01-2026-001"
  issueDate: string; // DD-MM-YYYY (AEAT format)

  // Client
  clientName: string;
  clientNif: string;
  clientCountry: string; // ISO alpha-2
  isClientSpanish: boolean; // true if clientCountry === "ES"

  // Service description
  description: string;

  // Amounts
  baseImponible: number;
  tipoImpositivo: number; // VAT rate e.g. 21
  cuotaRepercutida: number; // VAT amount
  cuotaTotal: number; // total VAT
  importeTotal: number; // total including VAT

  // Tax regime
  isExempt: boolean; // true when IVA exempt (art. 21 – export outside EU)

  // Invoice type. Defaults to "F1" (regular). For corrective invoices use R1-R5.
  tipoFactura?: "F1" | "R1" | "R2" | "R3" | "R4" | "R5";

  // Rectifying invoice fields (only when tipoFactura starts with "R").
  // tipoRectificativa: "S" = sustitución (full replacement), "I" = por diferencias
  tipoRectificativa?: "S" | "I";
  rectifiedInvoiceNumber?: string;
  rectifiedInvoiceDate?: string; // DD-MM-YYYY
  // Required for method "S": the original (pre-rectification) base and VAT amounts in EUR
  rectifiedBase?: number;
  rectifiedVat?: number;

  // Hash chain
  hash: string;
  previousHash: string;
  previousInvoiceNumber: string;
  previousInvoiceDate: string; // DD-MM-YYYY
  previousIssuerNif: string;

  // Timestamp
  fechaHoraHusoGenRegistro: string; // ISO 8601 with timezone e.g. 2024-09-13T19:20:30+01:00
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dec2(n: number): string {
  return n.toFixed(2);
}

function buildDestinatario(input: VerifactuXmlInput): string {
  if (input.isClientSpanish) {
    const clientNif = normalizeSpanishNifForAeat(input.clientNif);
    return `
        <sum1:IDDestinatario>
          <sum1:NombreRazon>${esc(input.clientName)}</sum1:NombreRazon>
          <sum1:NIF>${esc(clientNif)}</sum1:NIF>
        </sum1:IDDestinatario>`;
  }
  // Foreign client – use IDOtro
  // IDType "06" = Tax identification number in the country of residence
  return `
        <sum1:IDDestinatario>
          <sum1:NombreRazon>${esc(input.clientName)}</sum1:NombreRazon>
          <sum1:IDOtro>
            <sum1:CodigoPais>${esc(input.clientCountry)}</sum1:CodigoPais>
            <sum1:IDType>06</sum1:IDType>
            <sum1:ID>${esc(input.clientNif || "NO_ID")}</sum1:ID>
          </sum1:IDOtro>
        </sum1:IDDestinatario>`;
}

function buildDesglose(input: VerifactuXmlInput): string {
  if (input.isExempt) {
    // IVA exempt operation (art. 21 – exports outside EU).
    // For exemptions, AEAT requires OperacionExenta (E1-E6) instead of CalificacionOperacion (S1/S2/N1/N2).
    return `
      <sum1:Desglose>
        <sum1:DetalleDesglose>
          <sum1:ClaveRegimen>02</sum1:ClaveRegimen>
          <sum1:OperacionExenta>E2</sum1:OperacionExenta>
          <sum1:BaseImponibleOimporteNoSujeto>${dec2(input.baseImponible)}</sum1:BaseImponibleOimporteNoSujeto>
        </sum1:DetalleDesglose>
      </sum1:Desglose>`;
  }
  // Standard taxable operation
  // CalificacionOperacion = S1 (Sujeta – No exenta)
  return `
      <sum1:Desglose>
        <sum1:DetalleDesglose>
          <sum1:ClaveRegimen>01</sum1:ClaveRegimen>
          <sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion>
          <sum1:TipoImpositivo>${dec2(input.tipoImpositivo)}</sum1:TipoImpositivo>
          <sum1:BaseImponibleOimporteNoSujeto>${dec2(input.baseImponible)}</sum1:BaseImponibleOimporteNoSujeto>
          <sum1:CuotaRepercutida>${dec2(input.cuotaRepercutida)}</sum1:CuotaRepercutida>
        </sum1:DetalleDesglose>
      </sum1:Desglose>`;
}

function buildEncadenamiento(input: VerifactuXmlInput): string {
  // AEAT spec: Huella must be exactly 64 uppercase hex characters (SHA-256).
  const previousHashNormalized = (input.previousHash || "").toUpperCase().trim();
  const isValidHuella = /^[0-9A-F]{64}$/.test(previousHashNormalized);

  // Treat as first registro if no chain info, missing metadata, or invalid previous huella
  if (!isValidHuella || !input.previousInvoiceNumber || !input.previousInvoiceDate || !input.previousIssuerNif) {
    return `
      <sum1:Encadenamiento>
        <sum1:PrimerRegistro>S</sum1:PrimerRegistro>
      </sum1:Encadenamiento>`;
  }
  const previousIssuerNif = normalizeSpanishNifForAeat(input.previousIssuerNif);
  return `
      <sum1:Encadenamiento>
        <sum1:RegistroAnterior>
          <sum1:IDEmisorFactura>${esc(previousIssuerNif)}</sum1:IDEmisorFactura>
          <sum1:NumSerieFactura>${esc(input.previousInvoiceNumber)}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${esc(input.previousInvoiceDate)}</sum1:FechaExpedicionFactura>
          <sum1:Huella>${esc(previousHashNormalized)}</sum1:Huella>
        </sum1:RegistroAnterior>
      </sum1:Encadenamiento>`;
}

function buildSistemaInformatico(issuerName: string, issuerNif: string): string {
  const aeatIssuerNif = normalizeSpanishNifForAeat(issuerNif);
  return `
      <sum1:SistemaInformatico>
        <sum1:NombreRazon>${esc(issuerName || SIF.nombreRazon)}</sum1:NombreRazon>
        <sum1:NIF>${esc(aeatIssuerNif)}</sum1:NIF>
        <sum1:NombreSistemaInformatico>${esc(SIF.nombreSistemaInformatico)}</sum1:NombreSistemaInformatico>
        <sum1:IdSistemaInformatico>${esc(SIF.idSistemaInformatico)}</sum1:IdSistemaInformatico>
        <sum1:Version>${esc(SIF.version)}</sum1:Version>
        <sum1:NumeroInstalacion>${esc(SIF.numeroInstalacion)}</sum1:NumeroInstalacion>
        <sum1:TipoUsoPosibleSoloVerifactu>${SIF.tipoUsoPosibleSoloVerifactu}</sum1:TipoUsoPosibleSoloVerifactu>
        <sum1:TipoUsoPosibleMultiOT>${SIF.tipoUsoPosibleMultiOT}</sum1:TipoUsoPosibleMultiOT>
        <sum1:IndicadorMultiplesOT>${SIF.indicadorMultiplesOT}</sum1:IndicadorMultiplesOT>
      </sum1:SistemaInformatico>`;
}

function buildRectificacion(input: VerifactuXmlInput): string {
  const tipo = input.tipoFactura ?? "F1";
  if (!tipo.startsWith("R")) return "";
  const method = input.tipoRectificativa ?? "I";
  const num = input.rectifiedInvoiceNumber ?? "";
  const date = input.rectifiedInvoiceDate ?? "";
  const aeatIssuerNif = normalizeSpanishNifForAeat(input.issuerNif);
  let block = `
          <sum1:TipoRectificativa>${method}</sum1:TipoRectificativa>`;
  if (num && date) {
    block += `
          <sum1:FacturasRectificadas>
            <sum1:IDFacturaRectificada>
              <sum1:IDEmisorFactura>${esc(aeatIssuerNif)}</sum1:IDEmisorFactura>
              <sum1:NumSerieFactura>${esc(num)}</sum1:NumSerieFactura>
              <sum1:FechaExpedicionFactura>${esc(date)}</sum1:FechaExpedicionFactura>
            </sum1:IDFacturaRectificada>
          </sum1:FacturasRectificadas>`;
  }
  if (method === "S") {
    block += `
          <sum1:ImporteRectificacion>
            <sum1:BaseRectificada>${dec2(input.rectifiedBase ?? 0)}</sum1:BaseRectificada>
            <sum1:CuotaRectificada>${dec2(input.rectifiedVat ?? 0)}</sum1:CuotaRectificada>
          </sum1:ImporteRectificacion>`;
  }
  return block;
}

/**
 * Generate the full SOAP XML envelope for an invoice RegistroAlta
 * suitable for submission to the AEAT Verifactu sandbox.
 */
export function buildVerifactuXml(input: VerifactuXmlInput): string {
  const aeatIssuerNif = normalizeSpanishNifForAeat(input.issuerNif);
  const fechaHoraHusoGenRegistro = normalizeAeatDateTimeForAeat(input.fechaHoraHusoGenRegistro);
  const tipoFactura = input.tipoFactura ?? "F1";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAPENV}" xmlns:sum="${NS_SUM}" xmlns:sum1="${NS_SUM1}">
  <soapenv:Header/>
  <soapenv:Body>
    <sum:RegFactuSistemaFacturacion>
      <sum:Cabecera>
        <sum1:ObligadoEmision>
          <sum1:NombreRazon>${esc(input.issuerName)}</sum1:NombreRazon>
          <sum1:NIF>${esc(aeatIssuerNif)}</sum1:NIF>
        </sum1:ObligadoEmision>
      </sum:Cabecera>
      <sum:RegistroFactura>
        <sum1:RegistroAlta>
          <sum1:IDVersion>1.0</sum1:IDVersion>
          <sum1:IDFactura>
            <sum1:IDEmisorFactura>${esc(aeatIssuerNif)}</sum1:IDEmisorFactura>
            <sum1:NumSerieFactura>${esc(input.invoiceNumber)}</sum1:NumSerieFactura>
            <sum1:FechaExpedicionFactura>${esc(input.issueDate)}</sum1:FechaExpedicionFactura>
          </sum1:IDFactura>
          <sum1:NombreRazonEmisor>${esc(input.issuerName)}</sum1:NombreRazonEmisor>
          <sum1:TipoFactura>${tipoFactura}</sum1:TipoFactura>${buildRectificacion(input)}
          <sum1:DescripcionOperacion>${esc(input.description)}</sum1:DescripcionOperacion>
          <sum1:Destinatarios>${buildDestinatario(input)}
          </sum1:Destinatarios>${buildDesglose(input)}
          <sum1:CuotaTotal>${dec2(input.cuotaTotal)}</sum1:CuotaTotal>
          <sum1:ImporteTotal>${dec2(input.importeTotal)}</sum1:ImporteTotal>${buildEncadenamiento(input)}${buildSistemaInformatico(input.issuerName, input.issuerNif)}
          <sum1:FechaHoraHusoGenRegistro>${esc(fechaHoraHusoGenRegistro)}</sum1:FechaHoraHusoGenRegistro>
          <sum1:TipoHuella>01</sum1:TipoHuella>
          <sum1:Huella>${esc(input.hash)}</sum1:Huella>
        </sum1:RegistroAlta>
      </sum:RegistroFactura>
    </sum:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
  return xml;
}

export interface VerifactuAnulacionXmlInput {
  issuerName: string;
  issuerNif: string;
  invoiceNumber: string; // formatted number of the invoice being annulled
  issueDate: string; // DD-MM-YYYY of the original invoice
  hash: string; // huella of this RegistroAnulacion
  previousHash: string;
  previousInvoiceNumber: string;
  previousInvoiceDate: string;
  previousIssuerNif: string;
  fechaHoraHusoGenRegistro: string;
}

/**
 * Generate the SOAP XML envelope for a RegistroAnulacion.
 * The chain (Encadenamiento) follows the same per-issuer sequence as RegistroAlta:
 * the previous record may be either an Alta or an Anulacion of this issuer.
 */
export function buildVerifactuAnulacionXml(input: VerifactuAnulacionXmlInput): string {
  const aeatIssuerNif = normalizeSpanishNifForAeat(input.issuerNif);
  const fechaHoraHusoGenRegistro = normalizeAeatDateTimeForAeat(input.fechaHoraHusoGenRegistro);
  const previousHashNormalized = (input.previousHash || "").toUpperCase().trim();
  const isValidHuella = /^[0-9A-F]{64}$/.test(previousHashNormalized);
  const encadenamiento =
    !isValidHuella || !input.previousInvoiceNumber || !input.previousInvoiceDate || !input.previousIssuerNif
      ? `
      <sum1:Encadenamiento>
        <sum1:PrimerRegistro>S</sum1:PrimerRegistro>
      </sum1:Encadenamiento>`
      : `
      <sum1:Encadenamiento>
        <sum1:RegistroAnterior>
          <sum1:IDEmisorFactura>${esc(normalizeSpanishNifForAeat(input.previousIssuerNif))}</sum1:IDEmisorFactura>
          <sum1:NumSerieFactura>${esc(input.previousInvoiceNumber)}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${esc(input.previousInvoiceDate)}</sum1:FechaExpedicionFactura>
          <sum1:Huella>${esc(previousHashNormalized)}</sum1:Huella>
        </sum1:RegistroAnterior>
      </sum1:Encadenamiento>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAPENV}" xmlns:sum="${NS_SUM}" xmlns:sum1="${NS_SUM1}">
  <soapenv:Header/>
  <soapenv:Body>
    <sum:RegFactuSistemaFacturacion>
      <sum:Cabecera>
        <sum1:ObligadoEmision>
          <sum1:NombreRazon>${esc(input.issuerName)}</sum1:NombreRazon>
          <sum1:NIF>${esc(aeatIssuerNif)}</sum1:NIF>
        </sum1:ObligadoEmision>
      </sum:Cabecera>
      <sum:RegistroFactura>
        <sum1:RegistroAnulacion>
          <sum1:IDVersion>1.0</sum1:IDVersion>
          <sum1:IDFactura>
            <sum1:IDEmisorFacturaAnulada>${esc(aeatIssuerNif)}</sum1:IDEmisorFacturaAnulada>
            <sum1:NumSerieFacturaAnulada>${esc(input.invoiceNumber)}</sum1:NumSerieFacturaAnulada>
            <sum1:FechaExpedicionFacturaAnulada>${esc(input.issueDate)}</sum1:FechaExpedicionFacturaAnulada>
          </sum1:IDFactura>${encadenamiento}${buildSistemaInformatico(input.issuerName, input.issuerNif)}
          <sum1:FechaHoraHusoGenRegistro>${esc(fechaHoraHusoGenRegistro)}</sum1:FechaHoraHusoGenRegistro>
          <sum1:TipoHuella>01</sum1:TipoHuella>
          <sum1:Huella>${esc(input.hash)}</sum1:Huella>
        </sum1:RegistroAnulacion>
      </sum:RegistroFactura>
    </sum:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Download the generated XML as a file in the browser.
 */
export function downloadVerifactuXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
