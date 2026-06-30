import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Download, Plus, FileCode, Ban, RotateCw, FileSignature } from "lucide-react";
import { downloadPdf } from "@/lib/pdf";
import { formatMoney, buildDocNumber, type Currency, type Lang } from "@/lib/format";
import { classifyRemoveAction, type RemoveAction } from "@/lib/annulment";
import { buildVerifactuXml, downloadVerifactuXml, type VerifactuXmlInput } from "@/lib/verifactu-xml";
import { formatAeatDateTimeWithTimezone, isoToAeatDate, normalizeSpanishNifForAeat } from "@/lib/verifactu";
import { isEuCountry } from "@/lib/countries";

export const Route = createFileRoute("/_app/documents/")({
  component: DocumentsList,
});

interface DocRow {
  id: string;
  doc_type: "proforma" | "factura";
  seq_number: number;
  doc_month: number;
  doc_year: number;
  issue_date: string;
  formatted_number: string;
  client_name: string;
  service_name: string;
  amount_total: number;
  currency: Currency;
  language: Lang;
  amount_net: number;
  vat_rate: number;
  vat_amount: number;
  issuer_name: string;
  issuer_tax_number: string;
  issuer_address_line1: string;
  issuer_address_line2: string;
  issuer_country: string;
  client_tax_number: string;
  client_address_line1: string;
  client_address_line2: string;
  client_country: string;
  period_start: string | null;
  period_end: string | null;
  bank_name: string;
  bank_account_number: string;
  bank_swift: string;
  verifactu_hash: string;
  previous_hash: string;
  is_rectifying: boolean;
  rectification_type: string;
  rectification_method: string;
  rectification_reason: string;
  rectified_invoice_number: string;
  rectified_invoice_date: string | null;
  aeat_status: string;
  aeat_last_attempt_status: string;
  aeat_last_attempt_at: string | null;
  is_annulled: boolean;
  created_mode: "sandbox" | "production";
}

type SortKey = "seq" | "date" | "client" | "service" | "amount";

function DocumentsList() {
  const { user } = useAuth();
  const { t, lang } = useLocale();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMode, setCurrentMode] = useState<"sandbox" | "production">("sandbox");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterClients, setFilterClients] = useState<string[]>([]);
  const [filterServices, setFilterServices] = useState<string[]>([]);
  const [filterCurrencies, setFilterCurrencies] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date");

  async function load() {
    if (!user) return;
    setLoading(true);
    const [{ data, error }, { data: cs }] = await Promise.all([
      supabase.from("documents").select("*").eq("user_id", user.id),
      supabase.from("company_settings").select("verifactu_mode").eq("user_id", user.id).maybeSingle(),
    ]);
    if (error) toast.error(error.message);
    setDocs((data ?? []) as DocRow[]);
    if (cs?.verifactu_mode === "production" || cs?.verifactu_mode === "sandbox") {
      setCurrentMode(cs.verifactu_mode);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  // The mode toggle in the Documents section both filters the list and is
  // persisted as the company default mode (used as the default for newly
  // created / edited documents). Switching here keeps this section on the
  // chosen mode; overriding the mode inside a document does not change it.
  async function changeMode(next: "sandbox" | "production") {
    if (next === currentMode) return;
    setCurrentMode(next);
    if (user) {
      const { error } = await supabase
        .from("company_settings")
        .update({ verifactu_mode: next })
        .eq("user_id", user.id);
      if (error) toast.error(error.message);
    }
  }

  const modeDocs = useMemo(
    () => docs.filter((d) => (d.created_mode ?? "sandbox") === currentMode),
    [docs, currentMode],
  );

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of modeDocs) if (d.client_name) set.add(d.client_name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modeDocs]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of modeDocs) if (d.service_name) set.add(d.service_name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modeDocs]);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of modeDocs) if (d.currency) set.add(d.currency);
    return Array.from(set).sort();
  }, [modeDocs]);

  const visible = useMemo(() => {
    let arr = docs.filter((d) => (d.created_mode ?? "sandbox") === currentMode);
    if (filterTypes.length > 0) arr = arr.filter((d) => filterTypes.includes(d.doc_type));
    if (filterClients.length > 0) arr = arr.filter((d) => filterClients.includes(d.client_name));
    if (filterServices.length > 0) arr = arr.filter((d) => filterServices.includes(d.service_name));
    if (filterCurrencies.length > 0) arr = arr.filter((d) => filterCurrencies.includes(d.currency));
    arr.sort((a, b) => {
      if (sortKey === "seq") {
        if (a.doc_type !== b.doc_type) return a.doc_type.localeCompare(b.doc_type);
        return b.seq_number - a.seq_number;
      }
      if (sortKey === "date") {
        if (a.doc_year !== b.doc_year) return b.doc_year - a.doc_year;
        if (a.doc_month !== b.doc_month) return b.doc_month - a.doc_month;
        return b.seq_number - a.seq_number;
      }
      if (sortKey === "client") return a.client_name.localeCompare(b.client_name);
      if (sortKey === "service") return a.service_name.localeCompare(b.service_name);
      if (sortKey === "amount") return Number(b.amount_total) - Number(a.amount_total);
      return 0;
    });
    return arr;
  }, [docs, currentMode, filterTypes, filterClients, filterServices, filterCurrencies, sortKey]);


  // Smart-remove dialog state
  const [pending, setPending] = useState<{ doc: DocRow; action: RemoveAction; isLastInSequence?: boolean } | null>(null);

  async function onRemoveClick(d: DocRow) {
    const action = await classifyRemoveAction({
      id: d.id, doc_type: d.doc_type, aeat_status: d.aeat_status, is_annulled: d.is_annulled,
    });
    if (action.kind === "alreadyAnnulled") {
      toast.info(t.alreadyAnnulled);
      return;
    }
    if (action.kind === "blockedByRectifier") {
      toast.error(t.cannotAnnul, {
        description: t.annulRectifierFirst.replace("{n}", action.rectifierNumber),
      });
      return;
    }
    if (action.kind === "aeatAnnul") {
      // Redirect to edit page where the FNMT-cert annulment panel lives.
      navigate({ to: "/documents/$id", params: { id: d.id } });
      toast.info(t.annulInCardTitle, {
        description: t.annulInCardDesc,
      });
      return;
    }
    // hardDelete — show confirm dialog
    const hasLaterDoc = docs.some((doc) => doc.doc_type === d.doc_type && doc.seq_number > d.seq_number);
    setPending({ doc: d, action, isLastInSequence: !hasLaterDoc });
  }

  async function confirmHardDelete() {
    if (!pending) return;
    const { error } = await supabase.from("documents").delete().eq("id", pending.doc.id);
    if (error) toast.error(error.message);
    else {
      // Numbers are freed automatically on delete (no shared counter anymore).
      toast.success(t.docDeleted);
      load();
    }
    setPending(null);
  }

  async function onDownload(d: DocRow) {
    await downloadPdf({
      docType: d.doc_type, seqNumber: d.seq_number, docMonth: d.doc_month, docYear: d.doc_year,
      issueDate: d.issue_date, language: d.language, currency: d.currency,
      issuerName: d.issuer_name, issuerTaxNumber: d.issuer_tax_number,
      issuerAddressLine1: d.issuer_address_line1, issuerAddressLine2: d.issuer_address_line2,
      clientName: d.client_name, clientTaxNumber: d.client_tax_number,
      clientAddressLine1: d.client_address_line1, clientAddressLine2: d.client_address_line2,
      clientCountry: d.client_country ?? "",
      issuerCountry: d.issuer_country ?? "",
      serviceName: d.service_name, periodStart: d.period_start, periodEnd: d.period_end,
      amountNet: Number(d.amount_net), vatRate: Number(d.vat_rate),
      vatAmount: Number(d.vat_amount), amountTotal: Number(d.amount_total),
      bankName: d.bank_name, bankAccountNumber: d.bank_account_number, bankSwift: d.bank_swift,
      verifactuHash: d.verifactu_hash,
      // QR validator must match the mode the factura belongs to. If the factura
      // was already accepted by AEAT we use its recorded mode; otherwise fall
      // back to the company's current operating mode so a production company
      // gets a production QR even before AEAT confirms (never silently sandbox).
      verifactuMode: (((d as any).verifactu_mode ?? currentMode) ?? undefined) as "sandbox" | "production" | undefined,
      isRectifying: d.is_rectifying,
      rectificationType: d.rectification_type,
      rectificationMethod: (d.rectification_method === "S" ? "S" : "I"),
      rectificationReason: d.rectification_reason,
      rectifiedInvoiceNumber: d.rectified_invoice_number,
      rectifiedInvoiceDate: d.rectified_invoice_date ?? undefined,
      isAnnulled: d.is_annulled,
    });
  }

  function isSpanishFactura(d: DocRow): boolean {
    return d.doc_type === "factura" && d.language === "es" && d.issuer_country === "ES";
  }

  async function onDownloadXml(d: DocRow) {
    // Fetch previous invoice info for the chain
    let prevNumber = "";
    let prevDate = "";
    let prevNif = normalizeSpanishNifForAeat(d.issuer_tax_number);
    if (d.previous_hash) {
      const { data: prevDoc } = await supabase
        .from("documents")
        .select("formatted_number, issue_date, issuer_tax_number")
        .eq("verifactu_hash", d.previous_hash)
        .maybeSingle();
      if (prevDoc) {
        prevNumber = prevDoc.formatted_number;
        prevDate = isoToAeatDate(prevDoc.issue_date);
        prevNif = normalizeSpanishNifForAeat(prevDoc.issuer_tax_number);
      }
    }

    const isExempt = d.issuer_country === "ES" && d.client_country !== "" && !isEuCountry(d.client_country);
    const xmlInput: VerifactuXmlInput = {
      issuerName: d.issuer_name,
      issuerNif: normalizeSpanishNifForAeat(d.issuer_tax_number),
      invoiceNumber: d.formatted_number,
      issueDate: isoToAeatDate(d.issue_date),
      clientName: d.client_name,
      clientNif: d.client_tax_number,
      clientCountry: d.client_country,
      isClientSpanish: d.client_country === "ES",
      description: d.service_name,
      baseImponible: Number(d.amount_net),
      tipoImpositivo: Number(d.vat_rate),
      cuotaRepercutida: Number(d.vat_amount),
      cuotaTotal: Number(d.vat_amount),
      importeTotal: Number(d.amount_total),
      isExempt,
      hash: d.verifactu_hash,
      previousHash: d.previous_hash,
      previousInvoiceNumber: prevNumber,
      previousInvoiceDate: prevDate,
      previousIssuerNif: prevNif,
      fechaHoraHusoGenRegistro: formatAeatDateTimeWithTimezone(),
    };

    const xml = buildVerifactuXml(xmlInput);
    downloadVerifactuXml(xml, `${d.formatted_number}_verifactu.xml`);
    toast.success(t.xmlDownloaded);
  }

  const dateLang = lang === "ru" ? "ru-RU" : lang === "es" ? "es-ES" : "en-US";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.documentsTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.documentsSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t.docsModeSwitchLabel}:</span>
            <div className="inline-flex rounded-md border p-0.5">
              <button
                type="button"
                onClick={() => changeMode("sandbox")}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  currentMode === "sandbox"
                    ? "bg-success text-success-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.modeSandbox}
              </button>
              <button
                type="button"
                onClick={() => changeMode("production")}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  currentMode === "production"
                    ? "bg-production text-production-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.modeProduction}
              </button>
            </div>
          </div>
          <Button onClick={() => navigate({ to: "/documents/new" })}>
            <Plus className="mr-1 h-4 w-4" /> {t.newDocument}
          </Button>
        </div>
      </div>



      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="block text-xs text-muted-foreground">{t.filterType}</label>
            <MultiSelect
              width="w-40"
              options={[
                { value: "proforma", label: t.filterProformaOnly },
                { value: "factura", label: t.filterFacturaOnly },
              ]}
              selected={filterTypes}
              onChange={setFilterTypes}
              allLabel={t.filterAllTypes}
              selectedLabel={(n) => t.filterSelectedCount.replace("{n}", String(n))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-muted-foreground">{t.filterClient}</label>
            <MultiSelect
              width="w-44"
              options={clientOptions.map((c) => ({ value: c, label: c }))}
              selected={filterClients}
              onChange={setFilterClients}
              allLabel={t.filterAllClients}
              selectedLabel={(n) => t.filterSelectedCount.replace("{n}", String(n))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-muted-foreground">{t.filterService}</label>
            <MultiSelect
              width="w-44"
              options={serviceOptions.map((s) => ({ value: s, label: s }))}
              selected={filterServices}
              onChange={setFilterServices}
              allLabel={t.filterAllServices}
              selectedLabel={(n) => t.filterSelectedCount.replace("{n}", String(n))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-muted-foreground">{t.filterCurrency}</label>
            <MultiSelect
              width="w-28"
              options={currencyOptions.map((c) => ({ value: c, label: c }))}
              selected={filterCurrencies}
              onChange={setFilterCurrencies}
              allLabel={t.filterAllCurrencies}
              selectedLabel={(n) => t.filterSelectedCount.replace("{n}", String(n))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-muted-foreground">{t.sortBy}</label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t.sortDate}</SelectItem>
                <SelectItem value="seq">{t.sortSeq}</SelectItem>
                <SelectItem value="client">{t.sortClient}</SelectItem>
                <SelectItem value="service">{t.sortService}</SelectItem>
                <SelectItem value="amount">{t.sortAmount}</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.colNumber}</TableHead>
              <TableHead>{t.colDate}</TableHead>
              <TableHead>{t.colClient}</TableHead>
              <TableHead>{t.colService}</TableHead>
              <TableHead className="text-right">{t.colAmount}</TableHead>
              <TableHead className="w-[180px] text-right">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t.loading}</TableCell></TableRow>
            )}
            {!loading && visible.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t.noDocumentsYet}</TableCell></TableRow>
            )}
            {visible.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-24 shrink-0">
                      <Badge variant={d.doc_type === "proforma" ? "secondary" : "default"}>
                        {d.doc_type === "proforma" ? t.badgeInvoice : t.badgeFactura}
                      </Badge>
                    </div>
                    <span className="font-mono text-sm whitespace-nowrap">{d.formatted_number}</span>
                    <div className="flex items-center gap-2 flex-wrap ml-auto justify-end">
                      {d.is_rectifying && (
                        <Badge variant="destructive" title={d.rectification_reason || undefined}>
                          Rect.{d.rectification_type ? ` ${d.rectification_type}` : ""}
                        </Badge>
                      )}
                      {d.doc_type === "factura"
                        && (d.aeat_status || "").toLowerCase() === "correcto"
                        && ((d as any).verifactu_mode ?? null) === currentMode && (
                        <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
                          {t.acceptedBadge}
                        </Badge>
                      )}
                      {d.doc_type === "factura"
                        && (d.aeat_status || "").toLowerCase() !== "correcto"
                        && !d.is_annulled
                        && d.aeat_last_attempt_status
                        && ((d as any).verifactu_mode ?? null) === currentMode && (() => {
                          const when = d.aeat_last_attempt_at
                            ? new Date(d.aeat_last_attempt_at).toLocaleString(dateLang)
                            : "—";
                          const tooltip =
                            d.aeat_last_attempt_status === "timeout" ? t.notDeliveredTooltipTimeout
                            : d.aeat_last_attempt_status === "network_error" ? t.notDeliveredTooltipNetwork
                            : t.notDeliveredTooltipUnknown;
                          return (
                            <Badge
                              variant="outline"
                              className="border-orange-500 text-orange-700 dark:text-orange-400"
                              title={tooltip.replace("{when}", when)}
                            >
                              {t.notDeliveredBadge}
                            </Badge>
                          );
                        })()}
                      {d.is_annulled && ((d as any).verifactu_mode ?? null) === currentMode && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                          {t.annulledBadge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{new Date(d.issue_date).toLocaleDateString(dateLang)}</TableCell>
                <TableCell>{d.client_name || "—"}</TableCell>
                <TableCell>{d.service_name || "—"}</TableCell>
                <TableCell className="text-right">{formatMoney(Number(d.amount_total), d.currency, lang === "uk" ? "en" : lang)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <div className="w-9 h-9 flex items-center justify-center">
                      <Button variant="ghost" size="icon" onClick={() => onDownload(d)} title={t.downloadPdf}><Download className="h-4 w-4" /></Button>
                    </div>
                    <div className="w-9 h-9 flex items-center justify-center">
                      {isSpanishFactura(d) && (
                        <Button variant="ghost" size="icon" onClick={() => onDownloadXml(d)} title={t.downloadXml}><FileCode className="h-4 w-4" /></Button>
                      )}
                    </div>
                    <div className="w-9 h-9 flex items-center justify-center">
                      {d.doc_type === "factura"
                        && (d.aeat_status || "").toLowerCase() !== "correcto"
                        && !d.is_annulled
                        && d.aeat_last_attempt_status && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate({ to: "/documents/$id", params: { id: d.id } })}
                            title={t.retryAeatSend}
                            className="text-orange-700 dark:text-orange-400"
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        )}
                      {d.doc_type === "factura"
                        && (d.aeat_status || "").toLowerCase() !== "correcto"
                        && !d.is_annulled
                        && !d.aeat_last_attempt_status && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate({ to: "/documents/$id", params: { id: d.id } })}
                            title={t.signAndSendAction}
                            className="text-primary"
                          >
                            <FileSignature className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                    <div className="w-9 h-9 flex items-center justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title={t.editDoc}><Pencil className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate({ to: "/documents/$id", params: { id: d.id } })}>
                            {t.editExistingDoc}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: "/documents/new", search: { duplicate: d.id } })}>
                            {t.createNewFromThis}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="w-9 h-9 flex items-center justify-center">
                      {(() => {
                        const correcto = (d.aeat_status || "").toLowerCase() === "correcto";
                        if (d.is_annulled) {
                          return (
                            <Button variant="ghost" size="icon" disabled title={t.annulledBadge}>
                              <Ban className="h-4 w-4 opacity-50" />
                            </Button>
                          );
                        }
                        if (correcto) {
                          return (
                            <Button variant="ghost" size="icon" onClick={() => onRemoveClick(d)} title={t.annulInAeatTitle}>
                              <Ban className="h-4 w-4 text-amber-600" />
                            </Button>
                          );
                        }
                        return (
                          <Button variant="ghost" size="icon" onClick={() => onRemoveClick(d)} title={t.deleteForever}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!pending && pending.action.kind === "hardDelete"} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.hardDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.isLastInSequence ? t.hardDeleteDescReusable : t.hardDeleteDesc}
              {pending?.doc.formatted_number && (
                <div className="mt-2 font-mono text-foreground">{pending.doc.formatted_number}</div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHardDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
