import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/hooks/use-locale";
import { isDesktop, getDesktop, type DesktopCertInfo } from "@/lib/desktop";

interface SavedCert {
  name: string;
  info: DesktopCertInfo;
}

export function DesktopCertificateSection() {
  const { t } = useLocale();
  const desktop = isDesktop();
  const [saved, setSaved] = useState<SavedCert | null>(null);
  const [pickedBase64, setPickedBase64] = useState("");
  const [pickedName, setPickedName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const api = getDesktop();
    if (!api || typeof api.getSavedCertificate !== "function") {
      setSaved(null);
      return;
    }
    try {
      const res = await api.getSavedCertificate();
      if (res && "info" in res) setSaved({ name: res.name, info: res.info });
      else setSaved(null);
    } catch {
      setSaved(null);
    }
  }

  useEffect(() => { if (desktop) refresh(); }, [desktop]);

  async function handlePick() {
    const api = getDesktop();
    if (!api) return;
    const picked = await api.pickCertificate();
    if (!picked) return;
    setPickedBase64(picked.base64);
    setPickedName(picked.name);
  }

  async function handleSave() {
    const api = getDesktop();
    if (!api || !pickedBase64) return;
    if (!password) { toast.error(t.enterCertPassword); return; }
    setBusy(true);
    try {
      const res = await api.saveCertificate({ base64: pickedBase64, password, name: pickedName });
      if (!res.ok) throw new Error(res.error || "save failed");
      toast.success(t.certSavedToast);
      setPickedBase64(""); setPickedName(""); setPassword("");
      await refresh();
    } catch (e) {
      toast.error(t.certReadFailed, { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const api = getDesktop();
    if (!api) return;
    setBusy(true);
    await api.clearSavedCertificate();
    toast.success(t.certDeletedToast);
    setSaved(null);
    setBusy(false);
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">{t.desktopCertSectionTitle}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t.desktopCertSectionHint}</p>

      {!desktop && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
          {t.desktopCertOnlyDesktop}
        </div>
      )}

      {desktop && (
        <div className="mt-4 space-y-4">
          {saved ? (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {t.savedCertBadge}
                </div>
                <div><b>NIF:</b> {saved.info.nif}</div>
                <div className="truncate"><b>Subject:</b> {saved.info.subject}</div>
                <div><b>{t.validUntil}:</b> {saved.info.validFrom} — {saved.info.validTo}</div>
                <div className="text-muted-foreground">{saved.name}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t.deleteCertBtn}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.noCertSaved}</p>
              <div className="flex flex-wrap items-end gap-3">
                <Button onClick={handlePick} variant="outline" disabled={busy}>{t.pickCert}</Button>
                {pickedName && <span className="text-sm text-muted-foreground truncate max-w-[20rem]">{pickedName}</span>}
              </div>
              {pickedBase64 && (
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>{t.certPassword}</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
                  </div>
                  <Button onClick={handleSave} disabled={busy || !password}>
                    {t.saveCertBtn}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
