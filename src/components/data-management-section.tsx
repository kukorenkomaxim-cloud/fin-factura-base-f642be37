import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { exportMyData } from "@/lib/account.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { toast } from "sonner";

export function DataManagementSection() {
  const { t } = useLocale();
  const runExport = useServerFn(exportMyData);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const payload = await runExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fin-factura-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(t.exportError, { description: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">{t.dataManagementTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.dataManagementDesc}</p>

      <div className="mt-4 rounded-md border p-4">
        <p className="text-sm font-medium text-foreground">{t.exportMyData}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.exportMyDataDesc}</p>
        <Button className="mt-3" variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? t.exporting : t.exportBtn}
        </Button>
      </div>

      <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">{t.dangerZone}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.deleteAccountDesc}</p>
        <div className="mt-3">
          <DeleteAccountDialog />
        </div>
      </div>
    </Card>
  );
}
