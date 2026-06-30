// VerifactuAnularPanel — sign + submit a RegistroAnulacion to AEAT for an
// already-accepted factura. Mirrors the VerifactuSignPanel UX (cert + password
// + sign + submit) but builds an Anulacion XML instead of an Alta.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Ban, Send, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/hooks/use-locale";
import { isDesktop, getDesktop } from "@/lib/desktop";
import { buildVerifactuAnulacionXml } from "@/lib/verifactu-xml";
import {
  computeVerifactuAnulacionHash,
  formatAeatDateTimeWithTimezone,
  interpretAeatAnulacionResponseXml,
  isoToAeatDate,
  normalizeSpanishNifForAeat,
} from "@/lib/verifactu";
import { findActiveRectifierFor } from "@/lib/annulment";

const PENDING_KEY_PREFIX = "pendingAnulacionUpdate:";

type PendingUpdate = Partial<DocRow> & {
  annulled_at?: string | null;
  aeat_anulacion_signed_xml?: string;
  aeat_anulacion_response_xml?: string;
  aeat_anulacion_hash?: string;
};

async function updateWithRetry(
  documentId: string,
  update: PendingUpdate,
  attempts = 3,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.from("documents").update(update).eq("id", documentId);
    if (!error) return { ok: true };
    lastError = error;
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
  }
  return { ok: false, error: lastError };
}

interface Props {
  documentId: string;
}

interface DocRow {
  id: string;
  user_id: string;
  doc_type: string;
  formatted_number: string;
  issue_date: string;
  issuer_name: string;
  issuer_tax_number: string;
  verifactu_hash: string;
  aeat_status: string;
  is_annulled: boolean;
  aeat_anulacion_status: string;
  aeat_anulacion_csv: string;
  aeat_anulacion_error: string;
  aeat_anulacion_submitted_at: string | null;
}

export function VerifactuAnularPanel({ documentId }: Props) {
  const { t } = useLocale();
  const desktopAvailable = isDesktop();
  const [doc, setDoc] = useState<DocRow | null>(null);
  const [verifactuMode, setVerifactuMode] = useState<"sandbox" | "production">("sandbox");
  const [certBase64, setCertBase64] = useState("");
  const [certName, setCertName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [rectifier, setRectifier] = useState<{ id: string; formatted_number: string } | null>(null);

  useEffect(() => {
    (async () => {
      // Reconcile any pending update left behind by a previous successful
      // AEAT response whose DB write failed (fix for case C — desync risk).
      const pendingKey = PENDING_KEY_PREFIX + documentId;
      const pendingRaw = typeof localStorage !== "undefined" ? localStorage.getItem(pendingKey) : null;
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw) as PendingUpdate;
          const result = await updateWithRetry(documentId, pending, 3);
          if (result.ok) {
            localStorage.removeItem(pendingKey);
            toast.success(t.annulDbSaveRecovered);
          }
        } catch {
          // Leave the pending payload in place for another retry on next mount.
        }
      }

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
      if (cs?.verifactu_mode) setVerifactuMode(cs.verifactu_mode as "sandbox" | "production");
      const r = await findActiveRectifierFor(documentId);
      setRectifier(r);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  if (!doc) return null;
  if (doc.doc_type !== "factura") return null;
  // Only show for facturas accepted by AEAT
  if ((doc.aeat_status || "").toLowerCase() !== "correcto") return null;

  async function handlePickCert() {
    const desktop = getDesktop();
    if (!desktop) return;
    const picked = await desktop.pickCertificate();
    if (!picked) return;
    setCertBase64(picked.base64);
    setCertName(picked.name);
  }

  async function buildAnulacionXml(d: DocRow): Promise<{ xml: string; hash: string }> {
    const issuerNif = normalizeSpanishNifForAeat(d.issuer_tax_number);
    const issueAeat = isoToAeatDate(d.issue_date);
    const nowIso = formatAeatDateTimeWithTimezone();

    // Find latest hash in this issuer's chain (alta or anulacion).
    const { data: prevDocs } = await supabase
      .from("documents")
      .select(
        "id, formatted_number, issue_date, issuer_tax_number, verifactu_hash, aeat_anulacion_hash, verifactu_signed_at, aeat_anulacion_submitted_at",
      )
      .eq("user_id", d.user_id)
      .eq("doc_type", "factura")
      .order("issue_date", { ascending: false })
      .limit(50);

    let prevNumber = "";
    let prevDate = "";
    let prevNif = issuerNif;
    let prevHash = "";
    let prevTs = 0;
    for (const p of prevDocs || []) {
      const altaH = (p.verifactu_hash || "").toUpperCase();
      const anulH = (p.aeat_anulacion_hash || "").toUpperCase();
      const altaTs = p.verifactu_signed_at ? new Date(p.verifactu_signed_at).getTime() : 0;
      const anulTs = p.aeat_anulacion_submitted_at
        ? new Date(p.aeat_anulacion_submitted_at).getTime()
        : 0;
      // Pick the more recent of the two records on this row.
      let candHash = "";
      let candTs = 0;
      if (/^[0-9A-F]{64}$/.test(anulH) && anulTs >= altaTs) {
        candHash = anulH;
        candTs = anulTs;
      } else if (/^[0-9A-F]{64}$/.test(altaH)) {
        candHash = altaH;
        candTs = altaTs;
      }
      if (candHash && candTs > prevTs) {
        prevTs = candTs;
        prevHash = candHash;
        prevNumber = p.formatted_number;
        prevDate = isoToAeatDate(p.issue_date);
        prevNif = normalizeSpanishNifForAeat(p.issuer_tax_number);
      }
    }

    const huellaPrevious =
      /^[0-9A-F]{64}$/.test(prevHash) && prevNumber && prevDate && prevNif ? prevHash : "";

    const hash = await computeVerifactuAnulacionHash({
      nifEmisor: issuerNif,
      numSerieFactura: d.formatted_number,
      fechaExpedicion: issueAeat,
      huellaPrevious,
      fechaHoraHuella: nowIso,
    });

    const xml = buildVerifactuAnulacionXml({
      issuerName: d.issuer_name,
      issuerNif,
      invoiceNumber: d.formatted_number,
      issueDate: issueAeat,
      hash,
      previousHash: huellaPrevious,
      previousInvoiceNumber: prevNumber,
      previousInvoiceDate: prevDate,
      previousIssuerNif: prevNif,
      fechaHoraHusoGenRegistro: nowIso,
    });
    return { xml, hash };
  }

  async function handleSignAndSubmit() {
    const desktop = getDesktop();
    if (!desktop || !doc) return;
    if (rectifier) {
      toast.error(t.activeRectifierExists, {
        description: t.annulRectifierShort.replace("{n}", rectifier.formatted_number),
      });
      return;
    }
    if (!certBase64 || !password) {
      toast.error(t.selectCertAndPassword);
      return;
    }
    setBusy(true);
    try {
      const { xml, hash } = await buildAnulacionXml(doc);
      const signed = await desktop.signXml({ base64: certBase64, password, xml });
      if (!signed.ok || !signed.signedXml) throw new Error(signed.error || t.signFailed);
      const res = await desktop.submitToAeat({
        base64: certBase64,
        password,
        signedXml: signed.signedXml,
        mode: verifactuMode,
      });

      // Fix 2 — interpret duplicate annulment as accepted, so retries after a
      // lost network response don't get treated as fresh rejections.
      const interp = interpretAeatAnulacionResponseXml(res.responseXml || "");
      const accepted = res.ok || interp.accepted;
      const csv = res.csv || interp.csv || interp.duplicateOf?.peticionId || "";
      const status = accepted ? (res.estadoEnvio || "Correcto") : "Error";
      const nowIso = new Date().toISOString();

      // Fix 3 — only persist aeat_anulacion_hash when AEAT actually accepted
      // the registration. Writing it on rejection would poison the hash chain.
      const update: PendingUpdate = {
        aeat_anulacion_status: status,
        aeat_anulacion_csv: csv,
        aeat_anulacion_signed_xml: signed.signedXml,
        aeat_anulacion_response_xml: res.responseXml || "",
        aeat_anulacion_error: accepted ? "" : (res.errorMessage || interp.errorMessage || ""),
        aeat_anulacion_submitted_at: nowIso,
        is_annulled: accepted,
        annulled_at: accepted ? nowIso : null,
        ...(accepted ? { aeat_anulacion_hash: hash } : {}),
      };

      // Fix 1 — retry the DB update with backoff. If it still fails after a
      // successful AEAT response, persist the payload to localStorage so the
      // next mount can reconcile (avoids local/AEAT desync).
      const result = await updateWithRetry(doc.id, update, 3);
      if (!result.ok) {
        if (accepted && typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(PENDING_KEY_PREFIX + doc.id, JSON.stringify(update));
          } catch {
            /* quota exceeded — nothing we can do besides surface the toast */
          }
          toast.error(t.annulDbSaveFailed, { description: String(result.error) });
        } else {
          toast.error(t.annulSendError, { description: String(result.error) });
        }
        return;
      }

      setDoc({ ...doc, ...update } as DocRow);
      if (accepted) {
        if (interp.duplicateOf && !res.ok) {
          toast.success(t.aeatAlreadyAnnulled, {
            description: `Id petición: ${interp.duplicateOf.peticionId}`,
          });
        } else {
          toast.success(`${t.aeatAcceptedAnnul}${csv ? ` (CSV: ${csv})` : ""}`);
        }
      } else {
        toast.error(t.aeatRejectedAnnul, {
          description: res.errorMessage || interp.errorMessage || `HTTP ${res.httpStatus}`,
        });
      }
    } catch (e) {
      toast.error(t.annulSendError, { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  const alreadyDone = doc.is_annulled;

  return (
    <Card className="p-6 border-amber-300 dark:border-amber-700">
      <div className="flex items-center gap-2">
        <Ban className="h-5 w-5 text-amber-600" />
        <h2 className="font-semibold">{t.annulInAeatPanelTitle}</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {t.modeLabel}: <b>{verifactuMode === "sandbox" ? t.modeSandbox : t.modeProduction}</b>
        </span>
      </div>

      {alreadyDone && (
        <div className="mt-4 rounded-md bg-muted p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <CheckCircle2 className="h-4 w-4" />
            <b>{t.invoiceAnnulledMsg}</b>
          </div>
          {doc.aeat_anulacion_csv && <div><b>CSV (AEAT):</b> {doc.aeat_anulacion_csv}</div>}
          {doc.aeat_anulacion_submitted_at && (
            <div className="text-muted-foreground">
              {t.annulledAt}: {new Date(doc.aeat_anulacion_submitted_at).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {!alreadyDone && rectifier && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          {t.annulBlockedFull.replace("{n}", rectifier.formatted_number)}
        </div>
      )}

      {!alreadyDone && !rectifier && !desktopAvailable && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
          {t.annulDesktopOnly}
        </div>
      )}

      {!alreadyDone && !rectifier && desktopAvailable && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {t.annulNote}
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <Button onClick={handlePickCert} disabled={busy} variant="outline">
              {t.pickCert}
            </Button>
            {certName && (
              <span className="text-sm text-muted-foreground truncate max-w-[20rem]">{certName}</span>
            )}
          </div>

          {certBase64 && (
            <div className="space-y-2 max-w-md">
              <Label>{t.certPassword}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          <Button
            onClick={handleSignAndSubmit}
            disabled={busy || !certBase64 || !password}
            variant="destructive"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {t.signAndSendAnnul}
            <Send className="ml-2 h-4 w-4" />
          </Button>

          {doc.aeat_anulacion_submitted_at && doc.aeat_anulacion_status === "Error" && (
            <div className="rounded-md bg-muted p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <b>{t.lastAttempt}: {doc.aeat_anulacion_status}</b>
              </div>
              {doc.aeat_anulacion_error && (
                <div className="text-destructive"><b>{t.errorLabel}:</b> {doc.aeat_anulacion_error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
