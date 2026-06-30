// Shared document form used both for creating new documents and editing existing ones.
// Handles validation with "missing fields" warning dialog and PDF generation.

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale, pickServiceNameByLang } from "@/hooks/use-locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

import type { Currency, Lang } from "@/lib/format";
import { parseDocNumber, sameFormat, compareDocNumbers, computeNextNumber } from "@/lib/numbering";
import { computeVerifactuHash, fetchPreviousHash, isoToAeatDate } from "@/lib/verifactu";
import { fetchEuroRate, convertToEur, type FxRate } from "@/lib/fx";

export interface DocFormValue {
  id?: string;
  doc_type: "proforma" | "factura";
  client_id: string;
  service_id: string;
  bank_account_id: string;
  period_start: string;
  period_end: string;
  amount_net: string;
  vat_rate: string;
  currency: Currency;
  language: Lang;
  issue_date: string;
  // Rectifying invoice (Factura rectificativa) fields
  is_rectifying: boolean;
  rectification_type: "" | "R1" | "R2" | "R3" | "R4" | "R5";
  rectification_method: "I" | "S";
  rectification_reason: string;
  rectified_invoice_id: string;
  rectified_invoice_number: string;
  rectified_invoice_date: string;
  rectified_base: string;
  rectified_vat: string;
}

interface Client { id: string; name: string; tax_number: string; address_line1: string; address_line2: string; country: string; }
interface Service { id: string; name: string; name_ru: string; name_en: string; name_es: string; }
interface Bank { id: string; label: string; bank_name: string; account_number: string; swift: string; }
interface Company { name: string; tax_number: string; address_line1: string; address_line2: string; country: string; default_language: Lang; default_currency: Currency; verifactu_mode?: "sandbox" | "production" | null; }

interface Props {
  initial?: Partial<DocFormValue> & {
    seq_number?: number;
    doc_month?: number;
    doc_year?: number;
    formatted_number?: string;
    created_mode?: "sandbox" | "production";
    aeat_status?: string;
    created_at?: string;
  };
  mode: "create" | "edit";
  onSaved: (info: { id: string; docType: "proforma" | "factura" }) => void;
}

interface PriorFactura { id: string; formatted_number: string; issue_date: string; amount_total: number; currency: string; }

export function DocumentForm({ initial, mode, onSaved }: Props) {
  const { user } = useAuth();
  const { t, lang } = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [priorFacturas, setPriorFacturas] = useState<PriorFactura[]>([]);

  // Documents are ALWAYS issued in Spanish — that's the language the Spanish
  // tax authority understands. UI language is independent.
  const [form, setForm] = useState<DocFormValue>({
    doc_type: "proforma",
    client_id: "",
    service_id: "",
    bank_account_id: "",
    period_start: "",
    period_end: "",
    amount_net: "",
    vat_rate: "0",
    currency: "EUR",
    issue_date: new Date().toISOString().slice(0, 10),
    is_rectifying: false,
    rectification_type: "",
    rectification_method: "I",
    rectification_reason: "",
    rectified_invoice_id: "",
    rectified_invoice_number: "",
    rectified_invoice_date: "",
    rectified_base: "",
    rectified_vat: "",
    ...initial,
    // Force Spanish regardless of what `initial` provides
    language: "es",
  });

  const [missing, setMissing] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fx, setFx] = useState<FxRate | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string>("");

  // ── New numbering model state ────────────────────────────────────────
  // The editable document number (prefix + trailing counter).
  const [numberInput, setNumberInput] = useState<string>(initial?.formatted_number ?? "");
  // Existing documents in the current numbering "space" (doc_type x mode).
  const [spaceDocs, setSpaceDocs] = useState<
    { id: string; formatted_number: string; created_at: string; aeat_status: string; is_rectifying: boolean }[]
  >([]);
  // The user-defined "first number" stored for this space (defines the format).
  const [firstNumberStored, setFirstNumberStored] = useState<string>("");
  // Soft-warning dialog ("format" and/or "chrono"); confirming proceeds with save.
  const [numberWarnings, setNumberWarnings] = useState<string[] | null>(null);

  // The numbering mode this document belongs to. It defaults to the mode the
  // document was created in (edit) or the company default mode set via the
  // Documents toggle (create), but the user can override it here just for this
  // document. Sandbox/production numbering spaces are fully independent.
  const [createdMode, setCreatedMode] = useState<"sandbox" | "production">(
    initial?.created_mode === "production" ? "production" : "sandbox",
  );
  // For new documents, adopt the company default mode once it has loaded
  // (unless an explicit initial mode was provided).
  const [modeInitialized, setModeInitialized] = useState(!!initial?.created_mode);
  useEffect(() => {
    if (modeInitialized || mode !== "create" || !company) return;
    setCreatedMode(company.verifactu_mode === "production" ? "production" : "sandbox");
    setModeInitialized(true);
  }, [modeInitialized, mode, company]);

  // A factura already accepted by AEAT has a frozen, non-editable number.
  const numberFrozen =
    mode === "edit" &&
    form.doc_type === "factura" &&
    (initial?.aeat_status ?? "").toLowerCase() === "correcto";

  // The mode selector is locked once the factura is accepted by AEAT.
  const modeLocked = numberFrozen;

  // A rectifying invoice gets its number derived from the original (<orig>-Rx),
  // so the manual number field does not apply to it.
  const isRectifyingDoc = form.doc_type === "factura" && form.is_rectifying;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, s, b, comp, prior] = await Promise.all([
        supabase.from("clients").select("*").eq("user_id", user.id).order("name"),
        supabase.from("services").select("*").eq("user_id", user.id).order("name"),
        supabase.from("bank_accounts").select("*").eq("user_id", user.id).order("created_at"),
        supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("documents")
          .select("id, formatted_number, issue_date, amount_total, currency")
          .eq("user_id", user.id)
          .eq("doc_type", "factura")
          .order("issue_date", { ascending: false })
          .limit(200),
      ]);
      setClients((c.data ?? []) as Client[]);
      setServices((s.data ?? []) as Service[]);
      setBanks((b.data ?? []) as Bank[]);
      setPriorFacturas((prior.data ?? []) as PriorFactura[]);
      if (comp.data) {
        setCompany(comp.data as Company);
        if (mode === "create" && !initial) {
          setForm((f) => ({
            ...f,
            currency: (comp.data as Company).default_currency,
            language: "es",
          }));
        }
      }
    })();
  }, [user?.id]);

  // Load the current numbering space (existing numbers + stored "first number")
  // whenever the doc type or mode changes, and auto-fill the next number for
  // new (non-rectifying) documents.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [docsRes, fmtRes] = await Promise.all([
        supabase
          .from("documents")
          .select("id, formatted_number, created_at, aeat_status, is_rectifying")
          .eq("user_id", user.id)
          .eq("doc_type", form.doc_type)
          .eq("created_mode", createdMode),
        supabase
          .from("document_number_formats")
          .select("first_number")
          .eq("user_id", user.id)
          .eq("doc_type", form.doc_type)
          .eq("created_mode", createdMode)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const docs = (docsRes.data ?? []) as typeof spaceDocs;
      setSpaceDocs(docs);
      const first = (fmtRes.data?.first_number ?? "") as string;
      setFirstNumberStored(first);

      // Auto-fill the next number only for brand-new, non-rectifying documents.
      if (mode === "create" && !isRectifyingDoc) {
        const nonRect = docs.filter((d) => !d.is_rectifying).map((d) => d.formatted_number);
        setNumberInput(computeNextNumber(nonRect, first));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, form.doc_type, createdMode, mode, isRectifyingDoc]);

  // Validate a candidate document number against all numbering rules.
  // Returns a hard error (blocks save) and/or soft warnings (confirmable).
  function validateNumber(finalNumber: string): { hardError?: string; warnings: string[] } {
    const warnings: string[] = [];
    if (!finalNumber) return { hardError: t.numberRequired, warnings };
    if (!parseDocNumber(finalNumber)) return { hardError: t.numberInvalid, warnings };

    const others = spaceDocs.filter((d) => d.id !== form.id);

    // (в, г) Duplicate within the same space (doc_type x mode).
    const dup = others.find((d) => d.formatted_number === finalNumber);
    if (dup) {
      const frozen =
        form.doc_type === "factura" && (dup.aeat_status || "").toLowerCase() === "correcto";
      if (frozen) return { hardError: t.numberDupFrozen, warnings };
      return { hardError: t.numberDup.replace("{n}", dup.formatted_number), warnings };
    }

    const nonRect = others.filter((d) => !d.is_rectifying && parseDocNumber(d.formatted_number));
    if (nonRect.length > 0) {
      // (а) Format consistency: compare against the stored first number, or the
      // lowest existing number when no first number is stored.
      const ref =
        firstNumberStored && parseDocNumber(firstNumberStored)
          ? firstNumberStored
          : [...nonRect.map((d) => d.formatted_number)].sort(compareDocNumbers)[0];
      if (ref && !sameFormat(finalNumber, ref)) warnings.push("format");

      // (б) Chronological monotonicity by creation date.
      const thisCreated =
        mode === "edit" && initial?.created_at
          ? new Date(initial.created_at).getTime()
          : Date.now();
      for (const o of nonRect) {
        const oCreated = new Date(o.created_at).getTime();
        const cmp = compareDocNumbers(finalNumber, o.formatted_number);
        if (oCreated < thisCreated && cmp <= 0) { warnings.push("chrono"); break; }
        if (oCreated > thisCreated && cmp >= 0) { warnings.push("chrono"); break; }
      }
    }

    return { warnings: Array.from(new Set(warnings)) };
  }


  function update<K extends keyof DocFormValue>(key: K, value: DocFormValue[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const computed = useMemo(() => {
    const net = Number(form.amount_net.replace(",", ".")) || 0;
    const rate = Number(form.vat_rate.replace(",", ".")) || 0;
    const vat = +(net * (rate / 100)).toFixed(2);
    const total = +(net + vat).toFixed(2);
    return { net, rate, vat, total };
  }, [form.amount_net, form.vat_rate]);

  // Auto-fetch EUR exchange rate when currency != EUR.
  // Per BOE/Banco de España rules, the rate used is the one fixed on the
  // previous business day (handled inside fetchEuroRate).
  useEffect(() => {
    if (form.currency === "EUR") {
      setFx(null);
      setFxError("");
      return;
    }
    let cancelled = false;
    setFxLoading(true);
    setFxError("");
    fetchEuroRate(form.currency, form.issue_date)
      .then((r) => { if (!cancelled) setFx(r); })
      .catch((e) => { if (!cancelled) { setFx(null); setFxError(String(e?.message ?? e)); } })
      .finally(() => { if (!cancelled) setFxLoading(false); });
    return () => { cancelled = true; };
  }, [form.currency, form.issue_date]);

  const eurEquiv = useMemo(() => {
    if (form.currency === "EUR") {
      return { net: computed.net, vat: computed.vat, total: computed.total, rate: 1 };
    }
    const r = fx?.rate ?? 0;
    return {
      net: convertToEur(computed.net, r),
      vat: convertToEur(computed.vat, r),
      total: convertToEur(computed.total, r),
      rate: r,
    };
  }, [form.currency, fx, computed]);

  function findMissing(): string[] {
    const m: string[] = [];
    if (!form.client_id) m.push(t.fieldClient);
    if (!form.service_id) m.push(t.fieldService);
    if (!form.bank_account_id) m.push(t.fieldBank);
    if (!form.period_start) m.push(t.fieldPeriodStart);
    if (!form.period_end) m.push(t.fieldPeriodEnd);
    if (!form.amount_net || computed.net <= 0) m.push(t.fieldAmountNet);
    return m;
  }

  function onGenerateClick() {
    const m = findMissing();
    if (m.length > 0) { setMissing(m); return; }
    void doSave();
  }

  async function doSave(skipNumberWarnings = false) {
    if (!user || !company) return;

    const isRectCreate =
      mode === "create" &&
      form.doc_type === "factura" &&
      form.is_rectifying &&
      !!form.rectification_type &&
      !!form.rectified_invoice_number &&
      initial?.seq_number != null;

    // ── New numbering: validate the user-defined number before anything else ──
    let finalNumber = numberInput.trim();
    if (!isRectCreate) {
      const v = validateNumber(finalNumber);
      if (v.hardError) {
        toast.error(v.hardError);
        return;
      }
      if (!skipNumberWarnings && v.warnings.length > 0) {
        setNumberWarnings(v.warnings);
        return;
      }
    }

    // For non-EUR invoices we must have an EUR exchange rate (Banco de España).
    if (form.currency !== "EUR" && (!fx || !eurEquiv.rate)) {
      toast.error("No hay tipo de cambio EUR disponible", {
        description: fxError || "Espere a que se cargue el tipo de cambio antes de generar la factura.",
      });
      return;
    }

    setSubmitting(true);
    setNumberWarnings(null);

    const client = clients.find((c) => c.id === form.client_id);
    const service = services.find((s) => s.id === form.service_id);
    const bank = banks.find((b) => b.id === form.bank_account_id);
    const localizedServiceName = service ? pickServiceNameByLang(service, form.language) : "";

    const issue = new Date(form.issue_date);
    let doc_month = issue.getMonth() + 1;
    let doc_year = issue.getFullYear();
    let seq_number = initial?.seq_number ?? 0;
    let formatted_number: string;

    if (isRectCreate) {
      // Rectifying invoice: keep the original period; build <original>-<R-type>
      // with a -2/-3 suffix on collision.
      doc_month = initial?.doc_month ?? doc_month;
      doc_year = initial?.doc_year ?? doc_year;
      seq_number = initial?.seq_number ?? 0;
      const base = `${form.rectified_invoice_number}-${form.rectification_type}`;
      formatted_number = base;
      const { data: existing } = await supabase
        .from("documents")
        .select("formatted_number")
        .eq("user_id", user.id)
        .like("formatted_number", `${base}%`);
      const used = new Set((existing ?? []).map((r: { formatted_number: string }) => r.formatted_number));
      if (used.has(formatted_number)) {
        let i = 2;
        while (used.has(`${base}-${i}`)) i++;
        formatted_number = `${base}-${i}`;
      }
    } else {
      // Normal document: the number is exactly what the user defined/edited.
      formatted_number = finalNumber;
      const parsedValue = parseDocNumber(finalNumber)?.value ?? 0;
      // seq_number kept for legacy sorting/compat; clamp to int range.
      seq_number = Math.min(Math.max(parsedValue, 0), 2147483647);
    }


    // Determine invoice type for AEAT (F1 normal, R1-R5 rectifying)
    const tipoFactura: "F1" | "R1" | "R2" | "R3" | "R4" | "R5" =
      form.doc_type === "factura" && form.is_rectifying && form.rectification_type
        ? form.rectification_type
        : "F1";

    // Compute Verifactu hash chain for facturas. AEAT requires EUR amounts.
    let verifactuHash = "";
    let previousHash = "";
    if (form.doc_type === "factura") {
      previousHash = await fetchPreviousHash(supabase, user.id);
      const now = new Date().toISOString();
      verifactuHash = await computeVerifactuHash({
        nifEmisor: company.tax_number,
        numSerieFactura: formatted_number,
        fechaExpedicion: isoToAeatDate(form.issue_date),
        tipoFactura,
        cuotaTotal: eurEquiv.vat,
        importeTotal: eurEquiv.total,
        huellaPrevious: previousHash,
        fechaHoraHuella: now,
      });
    }

    const isRect = form.doc_type === "factura" && form.is_rectifying && !!form.rectification_type;
    const rectifiedBaseNum = Number(String(form.rectified_base).replace(",", ".")) || 0;
    const rectifiedVatNum = Number(String(form.rectified_vat).replace(",", ".")) || 0;

    const payload = {
      user_id: user.id,
      doc_type: form.doc_type,
      seq_number,
      doc_month, doc_year,
      issue_date: form.issue_date,
      formatted_number,
      created_mode: createdMode,
      client_id: form.client_id || null,
      client_name: client?.name ?? "",
      client_tax_number: client?.tax_number ?? "",
      client_address_line1: client?.address_line1 ?? "",
      client_address_line2: client?.address_line2 ?? "",
      client_country: client?.country ?? "",
      issuer_name: company.name,
      issuer_tax_number: company.tax_number,
      issuer_address_line1: company.address_line1,
      issuer_address_line2: company.address_line2,
      issuer_country: company.country,
      service_id: form.service_id || null,
      service_name: localizedServiceName,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      amount_net: computed.net,
      vat_rate: computed.rate,
      vat_amount: computed.vat,
      amount_total: computed.total,
      currency: form.currency,
      exchange_rate: eurEquiv.rate,
      exchange_rate_date: fx?.rateDate ?? form.issue_date,
      exchange_rate_source: fx?.source ?? "EUR",
      amount_net_eur: eurEquiv.net,
      vat_amount_eur: eurEquiv.vat,
      amount_total_eur: eurEquiv.total,
      bank_account_id: form.bank_account_id || null,
      bank_label: bank?.label ?? "",
      bank_name: bank?.bank_name ?? "",
      bank_account_number: bank?.account_number ?? "",
      bank_swift: bank?.swift ?? "",
      language: form.language,
      verifactu_hash: verifactuHash,
      previous_hash: previousHash,
      is_rectifying: isRect,
      rectification_type: isRect ? form.rectification_type : "",
      rectification_method: isRect ? form.rectification_method : "I",
      rectification_reason: isRect ? form.rectification_reason : "",
      rectified_invoice_id: isRect && form.rectified_invoice_id ? form.rectified_invoice_id : null,
      rectified_invoice_number: isRect ? form.rectified_invoice_number : "",
      rectified_invoice_date: isRect && form.rectified_invoice_date ? form.rectified_invoice_date : null,
      rectified_base: isRect ? rectifiedBaseNum : 0,
      rectified_vat: isRect ? rectifiedVatNum : 0,
    };

    let savedId = form.id ?? "";
    if (mode === "create") {
      const { data: inserted, error } = await supabase.from("documents").insert(payload).select("id").single();
      if (error) { toast.error(t.saveError, { description: error.message }); setSubmitting(false); return; }
      savedId = (inserted as { id: string }).id;
    } else {
      const { error } = await supabase.from("documents").update(payload).eq("id", form.id!);
      if (error) { toast.error(t.saveError, { description: error.message }); setSubmitting(false); return; }
    }

    // Persist the user-defined first number for this space the first time a
    // (non-rectifying) document is created in it. This captures the numbering
    // format so future auto-increments and format warnings have a reference.
    if (!isRectCreate && !firstNumberStored && formatted_number) {
      await supabase
        .from("document_number_formats")
        .upsert(
          {
            user_id: user.id,
            doc_type: form.doc_type,
            created_mode: createdMode,
            first_number: formatted_number,
          },
          { onConflict: "user_id,doc_type,created_mode" },
        );
    }


    toast.success(mode === "create" ? t.docCreated : t.docUpdated);
    setSubmitting(false);
    setMissing(null);
    onSaved({ id: savedId, docType: form.doc_type });
  }

  if (!company) return <div className="text-muted-foreground">{t.loadingDetails}</div>;

  return (
    <Card className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.docType}</Label>
          <Select
            value={form.doc_type}
            onValueChange={(v) => update("doc_type", v as DocFormValue["doc_type"])}
            disabled={mode === "edit" && initial?.doc_type === "factura"}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="proforma">{t.docTypeProforma}</SelectItem>
              <SelectItem value="factura">{t.docTypeFactura}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t.issueDate}</Label>
          <Input type="date" value={form.issue_date} onChange={(e) => update("issue_date", e.target.value)} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>{t.formModeLabel}</Label>
          <Select
            value={createdMode}
            onValueChange={(v) => setCreatedMode(v as "sandbox" | "production")}
            disabled={modeLocked}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">{t.modeSandbox}</SelectItem>
              <SelectItem value="production">{t.modeProduction}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {modeLocked ? t.formModeFrozenNote : t.formModeHint}
          </p>
        </div>


        {!isRectifyingDoc && (
          <div className="space-y-2 md:col-span-2">
            <Label>{t.docNumberLabel}</Label>
            <Input
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              disabled={numberFrozen}
              className="font-mono"
              placeholder="0042365"
            />
            <p className="text-xs text-muted-foreground">
              {numberFrozen
                ? t.docNumberFrozenNote
                : mode === "create" &&
                    spaceDocs.filter((d) => !d.is_rectifying).length === 0 &&
                    !firstNumberStored
                  ? t.docNumberFirstHint
                  : t.docNumberAutoHint}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>{t.client}</Label>
          <Select value={form.client_id} onValueChange={(v) => update("client_id", v)}>
            <SelectTrigger><SelectValue placeholder={t.selectClient} /></SelectTrigger>
            <SelectContent>
              {clients.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">{t.addClientFirst}</div>}
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t.service}</Label>
          <Select value={form.service_id} onValueChange={(v) => update("service_id", v)}>
            <SelectTrigger><SelectValue placeholder={t.selectService} /></SelectTrigger>
            <SelectContent>
              {services.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">{t.addServiceFirst}</div>}
              {services.map((s) => {
                // Show service name in UI language
                const uiName = pickServiceNameByLang(s, lang);
                // If doc language differs, show doc-language name hint
                const docName = form.language !== lang ? pickServiceNameByLang(s, form.language) : "";
                return (
                  <SelectItem key={s.id} value={s.id}>
                    {uiName}
                    {docName && docName !== uiName ? ` → ${docName}` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t.periodStart}</Label>
          <Input type="date" value={form.period_start} onChange={(e) => update("period_start", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t.periodEnd}</Label>
          <Input type="date" value={form.period_end} onChange={(e) => update("period_end", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t.amountExVat}</Label>
          <Input type="text" inputMode="decimal" placeholder="0.00" value={form.amount_net} onChange={(e) => update("amount_net", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t.vatRate}</Label>
          <Input type="text" inputMode="decimal" value={form.vat_rate} onChange={(e) => update("vat_rate", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t.currency}</Label>
          <Select value={form.currency} onValueChange={(v) => update("currency", v as Currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR €</SelectItem>
              <SelectItem value="USD">USD $</SelectItem>
              <SelectItem value="RUB">RUB ₽</SelectItem>
            </SelectContent>
          </Select>
        </div>



        <div className="space-y-2 md:col-span-2">
          <Label>{t.bankAccount}</Label>
          <Select value={form.bank_account_id} onValueChange={(v) => update("bank_account_id", v)}>
            <SelectTrigger><SelectValue placeholder={t.selectBank} /></SelectTrigger>
            <SelectContent>
              {banks.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">{t.addBankFirst}</div>}
              {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.label} — {b.bank_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.doc_type === "factura" && (mode === "create" || form.is_rectifying) && (
        <div className="rounded-md border p-4 space-y-3">
          <label className={`flex items-center gap-2 text-sm font-medium ${mode === "edit" ? "opacity-70" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={form.is_rectifying}
              onChange={(e) => update("is_rectifying", e.target.checked)}
              className="h-4 w-4"
              disabled={mode === "edit"}
            />
            Это корректирующая фактура (Factura rectificativa)
            {mode === "edit" && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (нельзя изменить — создавайте корректирующую через кнопку «Создать корректирующую фактуру»)
              </span>
            )}
          </label>

          {form.is_rectifying && (
            <div className="grid gap-3 md:grid-cols-2 pt-2">
              <div className="space-y-2">
                <Label>Тип корректировки (AEAT)</Label>
                <Select
                  value={form.rectification_type || ""}
                  onValueChange={(v) => update("rectification_type", v as DocFormValue["rectification_type"])}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R1">R1 — общая ошибка / изм. цены (art. 80.1, 80.2, 80.6)</SelectItem>
                    <SelectItem value="R2">R2 — банкротство клиента (art. 80.3)</SelectItem>
                    <SelectItem value="R3">R3 — безнадёжный долг (art. 80.4)</SelectItem>
                    <SelectItem value="R4">R4 — прочие случаи возврата</SelectItem>
                    <SelectItem value="R5">R5 — корректировка факт. упрощ. режима</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Способ корректировки</Label>
                <Select
                  value={form.rectification_method}
                  onValueChange={(v) => update("rectification_method", v as "I" | "S")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">По разнице (I) — рекомендуется</SelectItem>
                    <SelectItem value="S">Полная замена (S)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Исходная фактура</Label>
                <Select
                  value={form.rectified_invoice_id}
                  onValueChange={(v) => {
                    const p = priorFacturas.find((x) => x.id === v);
                    setForm((f) => ({
                      ...f,
                      rectified_invoice_id: v,
                      rectified_invoice_number: p?.formatted_number ?? "",
                      rectified_invoice_date: p?.issue_date ?? "",
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите исходную фактуру" /></SelectTrigger>
                  <SelectContent>
                    {priorFacturas.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Нет фактур для корректировки</div>
                    )}
                    {priorFacturas.filter((p) => p.id !== form.id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.formatted_number} — {p.issue_date} ({Number(p.amount_total).toFixed(2)} {p.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Причина корректировки</Label>
                <Input
                  value={form.rectification_reason}
                  onChange={(e) => update("rectification_reason", e.target.value)}
                  placeholder="Напр.: Corrección de importe por error en el precio unitario"
                />
              </div>

              {form.rectification_method === "S" && (
                <>
                  <div className="space-y-2">
                    <Label>Исходная база (EUR)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.rectified_base}
                      onChange={(e) => update("rectified_base", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Исходный НДС (EUR)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.rectified_vat}
                      onChange={(e) => update("rectified_vat", e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2 text-xs text-muted-foreground">
                В новой фактуре указывайте суммы:{" "}
                <b>по разнице (I)</b> — только дельту (часто отрицательную);{" "}
                <b>полная замена (S)</b> — итоговые корректные суммы (исходные указываются отдельно).
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-md bg-muted/40 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t.base}</span>
          <span>{computed.net.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t.vatLabel} {computed.rate}%:</span>
          <span>{computed.vat.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
          <span>{t.total}</span>
          <span>{computed.total.toFixed(2)} {form.currency}</span>
        </div>
      </div>

      {form.currency !== "EUR" && (
        <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-1">
          <div className="font-semibold">Equivalencia en EUR (a efectos fiscales — AEAT)</div>
          {fxLoading && <div className="text-muted-foreground">Obteniendo tipo de cambio…</div>}
          {fxError && <div className="text-destructive">{fxError}</div>}
          {fx && (
            <>
              <div className="text-xs text-muted-foreground">
                Tipo de cambio Banco de España (publicado en BOE) del {fx.rateDate}: 1 {form.currency} = {fx.rate.toFixed(6)} EUR
              </div>
              <div className="flex justify-between"><span>Base imponible:</span><span>{eurEquiv.net.toFixed(2)} €</span></div>
              <div className="flex justify-between"><span>IVA {computed.rate}%:</span><span>{eurEquiv.vat.toFixed(2)} €</span></div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total:</span><span>{eurEquiv.total.toFixed(2)} €</span></div>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onGenerateClick} disabled={submitting}>
          {submitting ? t.generating : mode === "create" ? t.generateBtn : t.save}
        </Button>
      </div>

      <AlertDialog open={missing !== null} onOpenChange={(o) => !o && setMissing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.missingFieldsTitle}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{t.missingFieldsDesc}</p>
                <ul className="ml-4 list-disc text-foreground">
                  {missing?.map((m) => <li key={m}>{m}</li>)}
                </ul>
                <p className="pt-2">{t.missingFieldsQuestion}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.goBackToForm}</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSave()}>{t.generateAnyway}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={numberWarnings !== null} onOpenChange={(o) => !o && setNumberWarnings(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {numberWarnings?.includes("format") ? t.numberFormatWarnTitle : t.numberChronoWarnTitle}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {numberWarnings?.includes("format") && <p>{t.numberFormatWarnDesc}</p>}
                {numberWarnings?.includes("chrono") && <p>{t.numberChronoWarnDesc}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.goBackToForm}</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSave(true)}>{t.numberWarnContinue}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
