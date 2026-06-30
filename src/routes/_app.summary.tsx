import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, type Currency } from "@/lib/format";

export const Route = createFileRoute("/_app/summary")({
  component: SummaryPage,
});

interface DocRow {
  doc_type: "proforma" | "factura";
  doc_month: number;
  doc_year: number;
  client_name: string;
  service_name: string;
  amount_total: number;
  currency: Currency;
}

function SummaryPage() {
  const { user } = useAuth();
  const { t, lang } = useLocale();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select("doc_type, doc_month, doc_year, client_name, service_name, amount_total, currency")
        .eq("user_id", user.id);
      setDocs((data ?? []) as DocRow[]);
      setLoading(false);
    })();
  }, [user?.id]);

  const byPeriod = useMemo(() => groupBy(docs, (d) => `${d.doc_year}-${pad2(d.doc_month)}`), [docs]);
  const byClient = useMemo(() => groupBy(docs, (d) => d.client_name || "—"), [docs]);
  const byService = useMemo(() => groupBy(docs, (d) => d.service_name || "—"), [docs]);

  const months = t.months as readonly string[];

  function formatPeriodKey(k: string) {
    const [y, m] = k.split("-");
    return `${months[Number(m) - 1]} ${y}`;
  }

  if (loading) return <div>{t.loading}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.summaryTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.summarySubtitle}</p>
      </div>

      <Tabs defaultValue="period">
        <TabsList>
          <TabsTrigger value="period">{t.tabPeriod}</TabsTrigger>
          <TabsTrigger value="client">{t.tabClient}</TabsTrigger>
          <TabsTrigger value="service">{t.tabService}</TabsTrigger>
        </TabsList>

        <TabsContent value="period">
          <SummaryTable rows={byPeriod} keyLabel={t.colPeriod} formatKey={formatPeriodKey} lang={lang} t={t} />
        </TabsContent>
        <TabsContent value="client">
          <SummaryTable rows={byClient} keyLabel={t.colClient} lang={lang} t={t} />
        </TabsContent>
        <TabsContent value="service">
          <SummaryTable rows={byService} keyLabel={t.colService} lang={lang} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface Grouped {
  key: string;
  proformaByCurrency: Record<string, number>;
  facturaByCurrency: Record<string, number>;
  count: number;
}

function groupBy(docs: DocRow[], keyFn: (d: DocRow) => string): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const d of docs) {
    const k = keyFn(d);
    let g = map.get(k);
    if (!g) { g = { key: k, proformaByCurrency: {}, facturaByCurrency: {}, count: 0 }; map.set(k, g); }
    const bucket = d.doc_type === "proforma" ? g.proformaByCurrency : g.facturaByCurrency;
    bucket[d.currency] = (bucket[d.currency] ?? 0) + Number(d.amount_total);
    g.count += 1;
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function SummaryTable({ rows, keyLabel, formatKey, lang, t }: { rows: Grouped[]; keyLabel: string; formatKey?: (k: string) => string; lang: string; t: Record<string, unknown> }) {
  if (rows.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">{t.noDataYet as string}</Card>;
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{keyLabel}</TableHead>
            <TableHead className="text-right">{t.colProforma as string}</TableHead>
            <TableHead className="text-right">{t.colFactura as string}</TableHead>
            <TableHead className="text-right">{t.colCount as string}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{formatKey ? formatKey(r.key) : r.key}</TableCell>
              <TableCell className="text-right">{renderTotals(r.proformaByCurrency, lang)}</TableCell>
              <TableCell className="text-right">{renderTotals(r.facturaByCurrency, lang)}</TableCell>
              <TableCell className="text-right">{r.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function renderTotals(byCur: Record<string, number>, lang: string) {
  const entries = Object.entries(byCur);
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col items-end">
      {entries.map(([cur, amt]) => (
        <span key={cur}>{formatMoney(amt, cur as Currency, lang as "ru" | "en" | "es")}</span>
      ))}
    </div>
  );
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
