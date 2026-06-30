import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useLocale } from "@/hooks/use-locale";
import { supabase } from "@/integrations/supabase/client";
import { DocumentForm, type DocFormValue } from "@/components/document-form";
import type { Currency, Lang } from "@/lib/format";

export const Route = createFileRoute("/_app/documents/new")({
  validateSearch: z.object({
    rectifies: z.string().optional(),
    duplicate: z.string().optional(),
  }),
  component: NewDocPage,
});

function NewDocPage() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const { rectifies, duplicate } = Route.useSearch();
  const [initial, setInitial] = useState<Partial<DocFormValue> & { seq_number?: number; doc_month?: number; doc_year?: number } | null>(null);
  const [loading, setLoading] = useState(!!rectifies || !!duplicate);

  useEffect(() => {
    if (rectifies) {
      (async () => {
        const { data } = await supabase.from("documents").select("*").eq("id", rectifies).maybeSingle();
        if (data) {
          setInitial({
            doc_type: "factura",
            client_id: data.client_id ?? "",
            service_id: data.service_id ?? "",
            bank_account_id: data.bank_account_id ?? "",
            currency: data.currency as Currency,
            language: data.language as Lang,
            vat_rate: String(data.vat_rate),
            seq_number: data.seq_number,
            doc_month: data.doc_month,
            doc_year: data.doc_year,
            is_rectifying: true,
            rectification_type: "R1",
            rectification_method: "I",
            rectification_reason: "",
            rectified_invoice_id: data.id,
            rectified_invoice_number: data.formatted_number,
            rectified_invoice_date: data.issue_date,
            rectified_base: String(data.amount_net_eur ?? data.amount_net ?? 0),
            rectified_vat: String(data.vat_amount_eur ?? data.vat_amount ?? 0),
          });
        }
        setLoading(false);
      })();
      return;
    }
    if (duplicate) {
      (async () => {
        const { data } = await supabase.from("documents").select("*").eq("id", duplicate).maybeSingle();
        if (data) {
          // Pre-fill client / service / period / amount / VAT / currency / bank
          // from the source document. doc_type is intentionally left blank so
          // the user picks it. issue_date defaults to today (form default).
          setInitial({
            client_id: data.client_id ?? "",
            service_id: data.service_id ?? "",
            bank_account_id: data.bank_account_id ?? "",
            period_start: data.period_start ?? "",
            period_end: data.period_end ?? "",
            amount_net: String(data.amount_net ?? ""),
            vat_rate: String(data.vat_rate ?? "0"),
            currency: data.currency as Currency,
          });
        }
        setLoading(false);
      })();
      return;
    }
  }, [rectifies, duplicate]);

  if (loading) return <div>Загрузка…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.newDocTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.newDocSubtitle}</p>
      </div>
      <DocumentForm
        mode="create"
        initial={initial ?? undefined}
        onSaved={({ id, docType }) => {
          if (docType === "factura") {
            navigate({ to: "/documents/$id", params: { id } });
          } else {
            navigate({ to: "/documents" });
          }
        }}
      />
    </div>
  );
}
