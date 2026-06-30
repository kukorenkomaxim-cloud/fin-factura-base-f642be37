import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, ChevronDown, ChevronUp, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/hooks/use-locale";

interface Props {
  documentId: string;
}

interface StatusRow {
  doc_type: string;
  verifactu_mode: string | null;
  aeat_status: string;
  aeat_csv: string;
  aeat_error_message: string;
  aeat_submitted_at: string | null;
  is_annulled: boolean;
  aeat_anulacion_status: string;
  aeat_anulacion_csv: string;
}

/**
 * Collapsible read-only panel that summarises the AEAT interaction state for a
 * factura. It is purely a UI helper rendered on the document page and is never
 * included in the generated PDF (the PDF is produced separately in src/lib/pdf.ts).
 * Default collapsed — opens only when the user clicks the toggle button.
 */
export function VerifactuStatusPanel({ documentId }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<StatusRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select(
          "doc_type, verifactu_mode, aeat_status, aeat_csv, aeat_error_message, aeat_submitted_at, is_annulled, aeat_anulacion_status, aeat_anulacion_csv",
        )
        .eq("id", documentId)
        .maybeSingle();
      if (data) setRow(data as StatusRow);
    })();
  }, [documentId, open]);

  if (row && row.doc_type !== "factura") return null;

  const mode = (row?.verifactu_mode ?? "") as "" | "sandbox" | "production";
  const status = (row?.aeat_status ?? "not_sent").toLowerCase();
  const accepted = status === "correcto";

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(
      () => toast.success(t.csvCopied),
      () => toast.error(t.csvCopyFailed),
    );
  }

  function aeatCsvUrl(): string | null {
    if (!row?.aeat_csv) return null;
    const base =
      mode === "production"
        ? "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarCSV"
        : "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarCSV";
    return `${base}?csv=${encodeURIComponent(row.aeat_csv)}`;
  }

  const statusBadge = accepted ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">{t.acceptedBadge}</Badge>
  ) : status === "not_sent" || status === "" ? (
    <Badge variant="secondary">{t.aeatNotSentBadge}</Badge>
  ) : (
    <Badge variant="destructive">{t.notDeliveredBadge}</Badge>
  );

  const csvUrl = aeatCsvUrl();

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <Activity className="h-4 w-4 text-muted-foreground" />
          {t.aeatStatusPanelTitle}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
          {open ? t.aeatStatusHide : t.aeatStatusShow}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t.statusLabel}:</span>
            {statusBadge}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t.modeLabel}:</span>
            {mode ? (
              <Badge variant="outline">{mode === "production" ? t.modeProduction : t.modeSandbox}</Badge>
            ) : (
              <span>—</span>
            )}
          </div>

          {row?.aeat_submitted_at && (
            <div>
              <span className="text-muted-foreground">{t.submittedAt}:</span>{" "}
              {new Date(row.aeat_submitted_at).toLocaleString()}
            </div>
          )}

          {row?.aeat_csv && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{t.aeatCsvLabel}:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.aeat_csv}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(row.aeat_csv)} title={t.copyCsv}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {csvUrl && (
                <a href={csvUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    {t.openAeatSite}
                  </Button>
                </a>
              )}
            </div>
          )}

          {!accepted && row?.aeat_error_message && (
            <div className="text-destructive">
              <span className="text-muted-foreground">{t.errorLabel}:</span> {row.aeat_error_message}
            </div>
          )}

          {row?.is_annulled && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground">{t.annulledBadge}:</span>
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                {(row.aeat_anulacion_status ?? "").toLowerCase() === "correcto" ? t.acceptedBadge : t.aeatNotSentBadge}
              </Badge>
              {row.aeat_anulacion_csv && (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.aeat_anulacion_csv}</code>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
