import { createFileRoute, useNavigate, useParams, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { DocumentForm, type DocFormValue } from "@/components/document-form";
import { VerifactuSignPanel } from "@/components/verifactu-sign-panel";
import { VerifactuAnularPanel } from "@/components/verifactu-anular-panel";
import { VerifactuStatusPanel } from "@/components/verifactu-status-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileEdit, Mail } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import type { Currency, Lang } from "@/lib/format";
import { SendEmailDialog, buildDefaultEmailContent } from "@/components/send-email-dialog";
import { buildDocNumber } from "@/lib/format";
import type { PdfDocInput } from "@/lib/pdf";

export const Route = createFileRoute("/_app/documents/$id")({
  component: EditDocPage,
});

function EditDocPage() {
  const { t } = useLocale();
  const { id } = useParams({ from: "/_app/documents/$id" });
  const navigate = useNavigate();
  const [initial, setInitial] = useState<
    | (Partial<DocFormValue> & {
        seq_number?: number;
        doc_month?: number;
        doc_year?: number;
        formatted_number?: string;
        created_mode?: "sandbox" | "production";
        aeat_status?: string;
        created_at?: string;
      })
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<string>("");
  const [isAnnulled, setIsAnnulled] = useState(false);
  const [aeatStatus, setAeatStatus] = useState<string>("");
  const [fullDoc, setFullDoc] = useState<Record<string, unknown> | null>(null);
  const [clientEmail, setClientEmail] = useState<string>("");
  const [companyMode, setCompanyMode] = useState<"sandbox" | "production" | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
      if (data) {
        setDocType(data.doc_type);
        setIsAnnulled(!!data.is_annulled);
        setAeatStatus(data.aeat_status ?? "");
        setFullDoc(data as unknown as Record<string, unknown>);
        const { data: cs } = await supabase
          .from("company_settings")
          .select("verifactu_mode")
          .eq("user_id", data.user_id)
          .maybeSingle();
        if (cs?.verifactu_mode === "production" || cs?.verifactu_mode === "sandbox") {
          setCompanyMode(cs.verifactu_mode);
        }
        if (data.client_id) {
          const { data: c } = await supabase.from("clients").select("email").eq("id", data.client_id).maybeSingle();
          setClientEmail(c?.email ?? "");
        }
        setInitial({
          id: data.id,
          doc_type: data.doc_type as "proforma" | "factura",
          client_id: data.client_id ?? "",
          service_id: data.service_id ?? "",
          bank_account_id: data.bank_account_id ?? "",
          period_start: data.period_start ?? "",
          period_end: data.period_end ?? "",
          amount_net: String(data.amount_net),
          vat_rate: String(data.vat_rate),
          currency: data.currency as Currency,
          language: data.language as Lang,
          issue_date: data.issue_date,
          seq_number: data.seq_number,
          doc_month: data.doc_month,
          doc_year: data.doc_year,
          formatted_number: data.formatted_number,
          created_mode: (data.created_mode ?? "sandbox") as "sandbox" | "production",
          aeat_status: data.aeat_status ?? "",
          created_at: data.created_at,
          is_rectifying: !!data.is_rectifying,
          rectification_type: (data.rectification_type ?? "") as DocFormValue["rectification_type"],
          rectification_method: (data.rectification_method ?? "I") as "I" | "S",
          rectification_reason: data.rectification_reason ?? "",
          rectified_invoice_id: data.rectified_invoice_id ?? "",
          rectified_invoice_number: data.rectified_invoice_number ?? "",
          rectified_invoice_date: data.rectified_invoice_date ?? "",
          rectified_base: data.rectified_base != null ? String(data.rectified_base) : "",
          rectified_vat: data.rectified_vat != null ? String(data.rectified_vat) : "",
        });
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div>{t.loading}</div>;
  if (!initial) return <div>{t.docNotFoundShort}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {t.editDocPageTitle}
            {isAnnulled && <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">{t.annulledBadge}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.editDocPageSubtitle}
          </p>
        </div>
        {docType === "factura" && !isAnnulled && (
          <Link to="/documents/new" search={{ rectifies: id }}>
            <Button variant="outline" size="sm">
              <FileEdit className="mr-2 h-4 w-4" />
              {t.createRectifying}
            </Button>
          </Link>
        )}
        {fullDoc && (
          <Button variant="outline" size="sm" onClick={() => setSendOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Отправить по email
          </Button>
        )}
      </div>
      <DocumentForm
        mode="edit"
        initial={initial}
        onSaved={() => navigate({ to: "/documents" })}
      />
      {docType === "factura" && <VerifactuStatusPanel documentId={id} />}
      {docType === "factura" && <VerifactuSignPanel documentId={id} />}
      {docType === "factura" && aeatStatus.toLowerCase() === "correcto" && (
        <VerifactuAnularPanel documentId={id} />
      )}
      {fullDoc && (
        <SendEmailDialogWrapper
          open={sendOpen}
          onOpenChange={setSendOpen}
          documentId={id}
          doc={fullDoc}
          clientEmail={clientEmail}
          companyMode={companyMode}
        />
      )}
    </div>
  );
}

function SendEmailDialogWrapper({
  open, onOpenChange, documentId, doc, clientEmail, companyMode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string;
  doc: Record<string, unknown>;
  clientEmail: string;
  companyMode: "sandbox" | "production" | null;
}) {
  const d = doc as Record<string, any>;
  const lang = (d.language ?? "ru") as "ru" | "en" | "es" | "uk";
  const pdfLang = (lang === "uk" ? "ru" : lang) as Lang;
  const number = d.formatted_number || buildDocNumber(d.doc_type, d.doc_month, d.doc_year, d.seq_number, pdfLang);
  const tpl = buildDefaultEmailContent({
    lang, docType: d.doc_type, number,
    issuerName: d.issuer_name ?? "", clientName: d.client_name ?? "",
  });
  const pdfInput: PdfDocInput = {
    docType: d.doc_type, seqNumber: d.seq_number, docMonth: d.doc_month, docYear: d.doc_year,
    formattedNumber: d.formatted_number ?? undefined,
    issueDate: d.issue_date, language: pdfLang, currency: d.currency,
    issuerName: d.issuer_name, issuerTaxNumber: d.issuer_tax_number,
    issuerAddressLine1: d.issuer_address_line1, issuerAddressLine2: d.issuer_address_line2,
    clientName: d.client_name, clientTaxNumber: d.client_tax_number,
    clientAddressLine1: d.client_address_line1, clientAddressLine2: d.client_address_line2,
    clientCountry: d.client_country ?? "", issuerCountry: d.issuer_country ?? "",
    serviceName: d.service_name, periodStart: d.period_start, periodEnd: d.period_end,
    amountNet: Number(d.amount_net), vatRate: Number(d.vat_rate),
    vatAmount: Number(d.vat_amount), amountTotal: Number(d.amount_total),
    bankName: d.bank_name, bankAccountNumber: d.bank_account_number, bankSwift: d.bank_swift,
    verifactuHash: d.verifactu_hash,
    verifactuMode: ((d.verifactu_mode ?? companyMode) ?? undefined) as "sandbox" | "production" | undefined,
    isRectifying: d.is_rectifying,
    rectificationType: d.rectification_type,
    rectificationMethod: (d.rectification_method === "S" ? "S" : "I"),
    rectificationReason: d.rectification_reason,
    rectifiedInvoiceNumber: d.rectified_invoice_number,
    rectifiedInvoiceDate: d.rectified_invoice_date ?? undefined,
    isAnnulled: d.is_annulled,
  };
  return (
    <SendEmailDialog
      open={open} onOpenChange={onOpenChange} documentId={documentId}
      defaultRecipient={clientEmail} defaultSubject={tpl.subject} defaultBody={tpl.body}
      pdfInput={pdfInput}
    />
  );
}

