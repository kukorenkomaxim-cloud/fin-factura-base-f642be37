// Bridge to the Electron desktop wrapper (factura-desktop).
// In a normal browser these APIs are undefined.

export interface DesktopCertInfo {
  subject: string;
  nif: string;
  validFrom: string;
  validTo: string;
}

export interface FacturaDesktop {
  isDesktop: true;
  pickCertificate: () => Promise<{ path: string; name: string; base64: string } | null>;
  getCertificateInfo: (args: { base64: string; password: string }) => Promise<DesktopCertInfo>;
  signXml: (args: {
    base64?: string;
    password?: string;
    xml: string;
  }) => Promise<{ ok: boolean; signedXml?: string; error?: string }>;
  submitToAeat: (args: {
    base64?: string;
    password?: string;
    signedXml: string;
    mode: "sandbox" | "production";
  }) => Promise<{
    ok: boolean;
    httpStatus?: number;
    csv?: string;
    estadoEnvio?: string;
    responseXml?: string;
    errorMessage?: string;
  }>;
  saveCertificate: (args: {
    base64: string;
    password: string;
    name?: string;
  }) => Promise<{ ok: boolean; name?: string; info?: DesktopCertInfo; error?: string }>;
  getSavedCertificate: () => Promise<
    { name: string; info: DesktopCertInfo } | { error: string } | null
  >;
  clearSavedCertificate: () => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    facturaDesktop?: FacturaDesktop;
  }
}

export function isDesktop(): boolean {
  return typeof window !== "undefined" && !!window.facturaDesktop?.isDesktop;
}

export function getDesktop(): FacturaDesktop | null {
  if (typeof window === "undefined") return null;
  return window.facturaDesktop ?? null;
}
