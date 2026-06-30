import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES, countryNameKey } from "@/lib/countries";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

interface Client {
  id: string;
  name: string;
  tax_number: string;
  address_line1: string;
  address_line2: string;
  country: string;
  email: string;
}

type Draft = Omit<Client, "id"> & { id: string | null };

const emptyDraft: Draft = {
  id: null,
  name: "",
  tax_number: "",
  address_line1: "",
  address_line2: "",
  country: "",
  email: "",
};


function ClientsPage() {
  const { user } = useAuth();
  const { t, lang } = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);

  const countryKey = countryNameKey(lang);
  const sortedCountries = useMemo(() => {
    return [...COUNTRIES].sort((a, b) => a[countryKey].localeCompare(b[countryKey], countryKey));
  }, [countryKey]);

  const countryLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of COUNTRIES) map.set(c.code, c[countryKey]);
    return map;
  }, [countryKey]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    setClients((data ?? []) as Client[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function openNew() {
    setDraft({ ...emptyDraft });
  }

  function openEdit(c: Client) {
    setDraft({ ...c });
  }

  async function saveDraft() {
    if (!user || !draft) return;
    const payload = {
      name: draft.name,
      tax_number: draft.tax_number,
      address_line1: draft.address_line1,
      address_line2: draft.address_line2,
      country: draft.country,
      email: draft.email.trim(),
    };
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      toast.error("Invalid email");
      return;
    }

    if (draft.id) {
      const { error } = await supabase.from("clients").update(payload).eq("id", draft.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("clients").insert({ user_id: user.id, ...payload });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t.saved);
    setDraft(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm(t.deleteClientConfirm)) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.clientsTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.clientsSubtitle}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> {t.add}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.clientName}</TableHead>
              <TableHead>{t.clientCountry}</TableHead>
              <TableHead className="w-[120px] text-right">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t.loading}</TableCell></TableRow>
            )}
            {!loading && clients.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t.noClientsYet}</TableCell></TableRow>
            )}
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.country ? (countryLabel.get(c.country) ?? c.country) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title={t.save}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={draft !== null} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t.clientName : t.add}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.clientName}</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.taxNumber}</Label>
                <Input value={draft.tax_number} onChange={(e) => setDraft({ ...draft, tax_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.addressLine1}</Label>
                <Input value={draft.address_line1} onChange={(e) => setDraft({ ...draft, address_line1: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.addressLine2}</Label>
                <Input value={draft.address_line2} onChange={(e) => setDraft({ ...draft, address_line2: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t.clientCountry}</Label>
                <Select value={draft.country || ""} onValueChange={(v) => setDraft({ ...draft, country: v })}>
                  <SelectTrigger><SelectValue placeholder={t.selectCountry} /></SelectTrigger>
                  <SelectContent>
                    {sortedCountries.map((co) => (
                      <SelectItem key={co.code} value={co.code}>{co[countryKey]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t.email}</Label>
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
            </div>

          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>{t.cancel}</Button>
            <Button onClick={saveDraft}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
