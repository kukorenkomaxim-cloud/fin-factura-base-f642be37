import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, Download, Send, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/hooks/use-locale";
import { isDesktop, getDesktop, type DesktopCertInfo } from "@/lib/desktop";
import { buildVerifactuXml } from "@/lib/verifactu-xml";
import { computeVerifactuHash, formatAeatDateTimeWithTimezone, interpretAeatAltaResponseXml, isoToAeatDate, normalizeSpanishNifForAeat } from "@/lib/verifactu";

interface Props {
  documentId: string;
}

/**
 * Classify a thrown error from `desktop.submitToAeat` into one of:
 * - "timeout": our 60s client-side deadline fired
 * - "network": connection-level failure (DNS, TLS, socket, no internet)
 * - "unknown": anything else (DB error, programmer error, etc.)
 *
 * Used to show user-friendly toasts that distinguish "AEAT is unreachable /
 * we never got an answer" from "AEAT replied and rejected" (handled
 * separately in the non-throwing path).
 */
function classifyAeatSubmitError(e: unknown): "timeout" | "network" | "unknown" {
  const msg = (e instanceof Error ? e.message : String(e)) || "";
  if (/AEAT_TIMEOUT|timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(msg)) {
    return "timeout";
  }
  if (
    /fetch failed|network|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|getaddrinfo|socket hang up|TLS|certificate|handshake|self[- ]signed|UNABLE_TO_VERIFY|offline/i.test(
      msg,
    )
  ) {
    return "network";
  }
  return "unknown";
}

interface DocRow {
  id: string;
  user_id: string;
  doc_type: string;
  formatted_number: string;
  issue_date: string;
  client_name: string;
  client_tax_number: string;
  client_country: string;
  service_name: string;
  amount_net: number;
  vat_rate: number;
  vat_amount: number;
  amount_total: number;
  currency: string;
  amount_net_eur: number;
  vat_amount_eur: number;
  amount_total_eur: number;
  verifactu_hash: string;
  previous_hash: string;
  issuer_name: string;
  issuer_tax_number: string;
  verifactu_signed_at: string | null;
  verifactu_signed_xml: string;
  aeat_status: string;
  aeat_csv: string;
  aeat_response_xml: string;
  aeat_error_message: string;
  aeat_submitted_at: string | null;
  aeat_last_attempt_status: string;
  aeat_last_attempt_at: string | null;
  is_rectifying?: boolean;
  rectification_type?: string;
  rectification_method?: string;
  rectified_invoice_number?: string;
  rectified_invoice_date?: string | null;
  rectified_base?: number;
  rectified_vat?: number;
}

export function VerifactuSignPanel({ documentId }: Props) {
  const { t } = useLocale();
  const desktopAvailable = isDesktop();
  const [doc, setDoc] = useState<DocRow | null>(null);
  const [verifactuMode, setVerifactuMode] = useState<"sandbox" | "production">("sandbox");
  const [certBase64, setCertBase64] = useState<string>("");
  const [certName, setCertName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [certInfo, setCertInfo] = useState<DesktopCertInfo | null>(null);
  const [savedCert, setSavedCert] = useState<{ name: string; info: DesktopCertInfo } | null>(null);
  const [busy, setBusy] = useState(false);
  const hasCredentials = !!savedCert || (!!certBase64 && !!password);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .maybeSingle();
      if (data) setDoc(data as DocRow);
      const { data: cs } = await supabase
        .from("company_settings")
        .select("verifactu_mode")
        .maybeSingle();
      if (cs?.verifactu_mode) {
        setVerifactuMode(cs.verifactu_mode as "sandbox" | "production");
      }
      const desktop = getDesktop();
      if (desktop) {
        const s = await desktop.getSavedCertificate();
        if (s && "info" in s) setSavedCert({ name: s.name, info: s.info });
        else setSavedCert(null);
      }
    })();
  }, [documentId]);

  // Hide entirely for non-facturas
  if (doc && doc.doc_type !== "factura") return null;

  async function handlePickCert() {
    const desktop = getDesktop();
    if (!desktop) return;
    const picked = await desktop.pickCertificate();
    if (!picked) return;
    setCertBase64(picked.base64);
    setCertName(picked.name);
    setCertInfo(null);
  }

  async function handleVerifyCert() {
    const desktop = getDesktop();
    if (!desktop || !certBase64) return;
    if (!password) {
      toast.error(t.enterCertPassword);
      return;
    }
    setBusy(true);
    try {
      const info = await desktop.getCertificateInfo({ base64: certBase64, password });
      setCertInfo(info);
      toast.success(`${t.certRead}: ${info.nif}`);
    } catch (e) {
      toast.error(t.certReadFailed, { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function buildXmlForDoc(d: DocRow): Promise<string> {
    const isClientSpanish = (d.client_country || "").toUpperCase() === "ES";
    const issueAeat = isoToAeatDate(d.issue_date);
    const nowIso = formatAeatDateTimeWithTimezone();
    const issuerNif = normalizeSpanishNifForAeat(d.issuer_tax_number);

    // Fetch previous invoice info for the chain (RegistroAnterior).
    // AEAT requires chaining to the most recent previously-submitted invoice
    // for this issuer. We pick the latest factura with a valid 64-hex SHA-256
    // huella, excluding the current document. If none exists, this is the
    // first invoice for the issuer (PrimerRegistro="S").
    let prevNumber = "";
    let prevDate = "";
    let prevNif = issuerNif;
    let prevHashValid = "";
    {
      const { data: prevDocs } = await supabase
        .from("documents")
        .select("id, formatted_number, issue_date, issuer_tax_number, verifactu_hash, aeat_status, verifactu_signed_at, created_at")
        .eq("user_id", d.user_id)
        .eq("doc_type", "factura")
        .neq("id", d.id)
        .order("issue_date", { ascending: false })
        .order("seq_number", { ascending: false })
        .limit(50);
      const candidate = (prevDocs || []).find((p) =>
        /^[0-9A-Fa-f]{64}$/.test(p.verifactu_hash || "")
      );
      if (candidate) {
        prevNumber = candidate.formatted_number;
        prevDate = isoToAeatDate(candidate.issue_date);
        prevNif = normalizeSpanishNifForAeat(candidate.issuer_tax_number);
        prevHashValid = (candidate.verifactu_hash || "").toUpperCase();
      }
    }

    // Only chain if previous huella is a valid 64-hex SHA-256.
    const huellaPrevious =
      prevHashValid && prevNumber && prevDate && prevNif ? prevHashValid : "";

    // For non-EUR invoices, AEAT requires amounts in EUR (Banco de España rate
    // published in BOE for the previous business day — already stored on the doc).
    const isEur = (d.currency || "EUR") === "EUR";
    const baseEur = isEur ? Number(d.amount_net) : Number(d.amount_net_eur);
    const vatEur = isEur ? Number(d.vat_amount) : Number(d.vat_amount_eur);
    const totalEur = isEur ? Number(d.amount_total) : Number(d.amount_total_eur);

    const isRect = !!d.is_rectifying && !!d.rectification_type;
    const tipoFactura = (isRect ? (d.rectification_type as "R1" | "R2" | "R3" | "R4" | "R5") : "F1");

    const recomputedHash = await computeVerifactuHash({
      nifEmisor: issuerNif,
      numSerieFactura: d.formatted_number,
      fechaExpedicion: issueAeat,
      tipoFactura,
      cuotaTotal: vatEur,
      importeTotal: totalEur,
      huellaPrevious,
      fechaHoraHuella: nowIso,
    });

    // Persist recomputed hash so the next factura's chain links to a valid value.
    if (recomputedHash !== d.verifactu_hash) {
      await supabase.from("documents").update({ verifactu_hash: recomputedHash }).eq("id", d.id);
      d.verifactu_hash = recomputedHash;
    }

    return buildVerifactuXml({
      issuerName: d.issuer_name,
      issuerNif,
      invoiceNumber: d.formatted_number,
      issueDate: issueAeat,
      clientName: d.client_name,
      clientNif: d.client_tax_number,
      clientCountry: (d.client_country || "ES").toUpperCase(),
      isClientSpanish,
      description: d.service_name || "Servicio",
      baseImponible: baseEur,
      tipoImpositivo: Number(d.vat_rate),
      cuotaRepercutida: vatEur,
      cuotaTotal: vatEur,
      importeTotal: totalEur,
      isExempt: Number(d.vat_rate) === 0,
      tipoFactura,
      tipoRectificativa: isRect ? ((d.rectification_method as "I" | "S") || "I") : undefined,
      rectifiedInvoiceNumber: isRect ? (d.rectified_invoice_number || "") : undefined,
      rectifiedInvoiceDate: isRect && d.rectified_invoice_date ? isoToAeatDate(d.rectified_invoice_date) : undefined,
      rectifiedBase: isRect ? Number(d.rectified_base ?? 0) : undefined,
      rectifiedVat: isRect ? Number(d.rectified_vat ?? 0) : undefined,
      hash: recomputedHash,
      previousHash: huellaPrevious,
      previousInvoiceNumber: prevNumber,
      previousInvoiceDate: prevDate,
      previousIssuerNif: prevNif,
      fechaHoraHusoGenRegistro: nowIso,
    });
  }

  async function handleSign() {
    const desktop = getDesktop();
    if (!desktop || !doc) return;
    if (!certBase64 || !password) {
      toast.error(t.selectCertFirst);
      return;
    }
    setBusy(true);
    try {
      const xml = await buildXmlForDoc(doc);
      const result = await desktop.signXml({ base64: certBase64, password, xml });
      if (!result.ok || !result.signedXml) {
        throw new Error(result.error || t.signFailed);
      }
      // Persist signed XML
      const { error } = await supabase
        .from("documents")
        .update({
          verifactu_signed_xml: result.signedXml,
          verifactu_signed_at: new Date().toISOString(),
          aeat_status: "not_sent",
          aeat_csv: "",
          aeat_response_xml: "",
          aeat_error_message: "",
          aeat_submitted_at: null,
          // Re-signing produces a fresh XML — any prior transport failure is
          // obsolete. Clear the local journal so no stale badge lingers.
          aeat_last_attempt_status: "",
          aeat_last_attempt_at: null,
        })
        .eq("id", doc.id);
      if (error) throw error;
      toast.success(t.invoiceSigned);
      setDoc({
        ...doc,
        verifactu_signed_xml: result.signedXml,
        verifactu_signed_at: new Date().toISOString(),
        aeat_status: "not_sent",
        aeat_csv: "",
        aeat_response_xml: "",
        aeat_error_message: "",
        aeat_submitted_at: null,
      });
    } catch (e) {
      toast.error(t.signError, { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitAeat() {
    const desktop = getDesktop();
    if (!desktop || !doc) return;
    if (!doc.verifactu_signed_xml) {
      toast.error(t.signXmlFirst);
      return;
    }
    if (doc.verifactu_signed_xml.includes("00000000T") || /<[^>]*:NIF>ES[A-Z0-9]/i.test(doc.verifactu_signed_xml)) {
      toast.error(t.xmlOldFormat, {
        description: t.xmlOldFormatDesc,
      });
      return;
    }
    if (!certBase64 || !password) {
      toast.error(t.needCertForMtls);
      return;
    }
    setBusy(true);
    try {
      // (e) Hard client-side timeout of 60s. The underlying Electron HTTPS
      // request may have no timeout of its own and could hang indefinitely
      // on half-dead networks / silent proxy drops / unresponsive AEAT.
      const AEAT_TIMEOUT_MS = 60_000;
      const submitPromise = desktop.submitToAeat({
        base64: certBase64,
        password,
        signedXml: doc.verifactu_signed_xml,
        mode: verifactuMode,
      });
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("AEAT_TIMEOUT")),
          AEAT_TIMEOUT_MS,
        );
      });
      let res: Awaited<typeof submitPromise>;
      try {
        res = await Promise.race([submitPromise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      // Re-interpret the raw AEAT XML so that "Registro duplicado" with
      // EstadoRegistroDuplicado=Correcta is recognised as a successful prior
      // registration rather than an error.
      const interp = interpretAeatAltaResponseXml(res.responseXml || "");
      const accepted = res.ok || interp.accepted;
      const csv = res.csv || interp.csv || interp.duplicateOf?.peticionId || "";
      const update = {
        aeat_status: accepted ? "Correcto" : "Error",
        aeat_csv: csv,
        aeat_response_xml: res.responseXml || "",
        aeat_error_message: accepted ? "" : (res.errorMessage || interp.errorMessage || ""),
        aeat_submitted_at: new Date().toISOString(),
        // Remember which AEAT environment this factura was registered in so
        // the QR in the PDF always points to the matching validator, even if
        // the user later switches verifactu_mode in settings.
        verifactu_mode: accepted ? verifactuMode : (doc as any).verifactu_mode ?? null,
        // AEAT replied (accepted or rejected on business grounds). Clear the
        // local "last attempt failed" journal — there is no transport-level
        // problem to surface anymore.
        aeat_last_attempt_status: "",
        aeat_last_attempt_at: null,
      };
      const { error } = await supabase.from("documents").update(update).eq("id", doc.id);
      if (error) throw error;
      setDoc({ ...doc, ...update });
      if (accepted) {
        if (interp.duplicateOf && !res.ok) {
          toast.success(t.aeatAlreadyRegistered, {
            description: `Id petición: ${interp.duplicateOf.peticionId}`,
          });
        } else {
          toast.success(`${t.aeatAccepted}${csv ? ` (CSV: ${csv})` : ""}`);
        }
      } else {
        // (a) + (f) AEAT responded but rejected on business grounds.
        // Show the AEAT-provided reason and add a user-friendly hint.
        const reason = res.errorMessage || interp.errorMessage || `HTTP ${res.httpStatus}`;
        toast.error(t.aeatRejected, {
          description: `${reason}\n\n${t.aeatRejectedDesc}`,
        });
      }
    } catch (e) {
      // (a) + (e) + (f) Classify the failure and show a user-friendly toast.
      const kind = classifyAeatSubmitError(e);
      // Persist the failed attempt to the local journal so the documents
      // list can show a "Not delivered to AEAT" badge + retry button on
      // any device. AEAT result fields are intentionally NOT touched —
      // those still reflect what AEAT said (or "not_sent" if never sent).
      const journalStatus =
        kind === "timeout" ? "timeout"
        : kind === "network" ? "network_error"
        : "unknown_error";
      const journalUpdate = {
        aeat_last_attempt_status: journalStatus,
        aeat_last_attempt_at: new Date().toISOString(),
      };
      try {
        await supabase.from("documents").update(journalUpdate).eq("id", doc.id);
        setDoc({ ...doc, ...journalUpdate } as DocRow);
      } catch {
        // Journal write is best-effort; the toast already informed the user.
      }
      if (kind === "timeout") {
        toast.error(t.aeatTimeoutTitle, { description: t.aeatTimeoutDesc });
      } else if (kind === "network") {
        toast.error(t.aeatNetworkErrorTitle, {
          description: `${t.aeatNetworkErrorDesc}\n\n${String(e)}`,
        });
      } else {
        toast.error(t.aeatSendError, {
          description: `${t.aeatUnknownErrorDesc}\n\n${String(e)}`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadSigned() {
    if (!doc?.verifactu_signed_xml) return;
    const blob = new Blob([doc.verifactu_signed_xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.formatted_number.replace(/\s+/g, "_")}-signed.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!doc) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">{t.verifactuSignTitle}</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {t.modeLabel}: <b>{verifactuMode === "sandbox" ? t.modeSandbox : t.modeProduction}</b>
        </span>
      </div>

      {!desktopAvailable && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
          {t.desktopOnlyNote}
        </div>
      )}

      {desktopAvailable && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Button onClick={handlePickCert} disabled={busy} variant="outline">
              {t.pickCert}
            </Button>
            {certName && (
              <span className="text-sm text-muted-foreground truncate max-w-[20rem]">
                {certName}
              </span>
            )}
          </div>

          {certBase64 && (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>{t.certPassword}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <Button onClick={handleVerifyCert} disabled={busy} variant="secondary">
                {t.checkBtn}
              </Button>
            </div>
          )}

          {certInfo && (
            <div className="rounded-md bg-muted p-3 text-xs">
              <div><b>NIF:</b> {certInfo.nif}</div>
              <div><b>Subject:</b> {certInfo.subject}</div>
              <div><b>{t.validUntil}:</b> {certInfo.validFrom} — {certInfo.validTo}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSign} disabled={busy || !certBase64 || !password}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t.signXmlBtn}
            </Button>
            {doc.verifactu_signed_xml && (
              <Button variant="outline" onClick={handleDownloadSigned}>
                <Download className="mr-2 h-4 w-4" />
                {t.downloadSignedXml}
              </Button>
            )}
          </div>

          {doc.verifactu_signed_at && (
            <p className="text-xs text-muted-foreground">
              {t.signedAt}: {new Date(doc.verifactu_signed_at).toLocaleString()}
            </p>
          )}

          {doc.verifactu_signed_xml && (
            <div className="border-t pt-4 mt-2 space-y-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t.aeatSubmitTitle} ({verifactuMode === "sandbox" ? t.modeSandboxLower : t.modeProductionUpper})</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.mtlsNote}
              </p>
              <Button
                onClick={handleSubmitAeat}
                disabled={busy || !certBase64 || !password}
                variant={verifactuMode === "production" ? "destructive" : "default"}
              >
                <Send className="mr-2 h-4 w-4" />
                {t.submitToAeatBtn} {verifactuMode === "sandbox" ? "(sandbox)" : `(${t.modeProductionUpper})`}
              </Button>

              {doc.aeat_submitted_at && (
                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    {doc.aeat_status === "Error" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    <b>{t.statusLabel}:</b> {doc.aeat_status}
                  </div>
                  {doc.aeat_csv && <div><b>{t.aeatCsvLabel}:</b> {doc.aeat_csv}</div>}
                  {doc.aeat_error_message && (
                    <div className="text-destructive"><b>{t.errorLabel}:</b> {doc.aeat_error_message}</div>
                  )}
                  <div className="text-muted-foreground">
                    {t.submittedAt}: {new Date(doc.aeat_submitted_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
