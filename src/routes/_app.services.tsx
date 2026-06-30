import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale, pickServiceNameByLang } from "@/hooks/use-locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Languages } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/lib/format";

export const Route = createFileRoute("/_app/services")({
  component: ServicesPage,
});

interface Service {
  id: string;
  name: string;
  name_ru: string;
  name_en: string;
  name_es: string;
  description: string;
}

type Draft = Omit<Service, "id"> & { id: string | null };

const emptyDraft: Draft = {
  id: null,
  name: "",
  name_ru: "",
  name_en: "",
  name_es: "",
  description: "",
};

const ALL_LANGS: Lang[] = ["ru", "en", "es"];

function ServicesPage() {
  const { user } = useAuth();
  const { t, lang } = useLocale();
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [translating, setTranslating] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    setItems((data ?? []) as Service[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function openNew() {
    setDraft({ ...emptyDraft });
  }

  function openEdit(s: Service) {
    setDraft({ ...s });
  }

  async function saveDraft() {
    if (!user || !draft) return;
    const payload = {
      name: draft.name_ru || draft.name_en || draft.name_es || draft.name,
      name_ru: draft.name_ru,
      name_en: draft.name_en,
      name_es: draft.name_es,
      description: draft.description,
    };
    if (draft.id) {
      const { error } = await supabase.from("services").update(payload).eq("id", draft.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("services").insert({ user_id: user.id, ...payload });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t.saved);
    setDraft(null);
    load();
  }

  async function autoTranslate() {
    if (!draft) return;
    const sourceField = `name_${lang}` as keyof Draft;
    const sourceText = draft[sourceField] as string;
    if (!sourceText.trim()) {
      toast.error(lang === "ru" ? "Сначала введите название" : lang === "es" ? "Primero introduce el nombre" : "Enter the name first");
      return;
    }

    const targetLangs = ALL_LANGS.filter((l) => l !== lang);
    setTranslating(true);

    try {
      const { data, error } = await supabase.functions.invoke("translate-service", {
        body: { text: sourceText, sourceLang: lang, targetLangs },
      });

      if (error) throw error;

      setTranslating(false);
      const updated = { ...draft };
      for (const tl of targetLangs) {
        const key = `name_${tl}` as keyof Draft;
        if (data[key]) {
          (updated as Record<string, string>)[key] = data[key];
        }
      }
      setDraft(updated);
      toast.success(t.saved);
    } catch (err) {
      console.error(err);
      setTranslating(false);
      toast.error("Translation failed");
    }
  }

  async function remove(id: string) {
    if (!confirm(t.deleteServiceConfirm)) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  const langLabels: Record<Lang, string> = {
    ru: t.serviceNameRu,
    en: t.serviceNameEn,
    es: t.serviceNameEs,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.servicesTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.servicesSubtitle}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> {t.add}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.serviceNameRu.split(" ")[0]}</TableHead>
              <TableHead className="w-[120px] text-right">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">{t.loading}</TableCell></TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">{t.noServicesYet}</TableCell></TableRow>
            )}
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{pickServiceNameByLang(s, lang) || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} title={t.save}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
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
            <DialogTitle>{draft?.id ? t.serviceNameRu.split(" ")[0] : t.add}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3 md:grid-cols-3">
              {ALL_LANGS.map((l) => {
                const field = `name_${l}` as keyof Draft;
                return (
                  <div key={l} className="space-y-2">
                    <Label>{langLabels[l]}{l === lang ? " ★" : ""}</Label>
                    <Input
                      value={draft[field] as string}
                      onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                      placeholder={l === lang ? (lang === "ru" ? "Введите название" : lang === "es" ? "Introduce el nombre" : "Enter name") : ""}
                    />
                  </div>
                );
              })}
              <div className="mt-1 space-y-2 md:col-span-3">
                <Label>{t.serviceDescription}</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={autoTranslate}
              disabled={translating}
            >
              <Languages className="mr-1 h-4 w-4" />
              {translating ? t.translating : (lang === "ru" ? "Перевести" : lang === "es" ? "Traducir" : "Translate")}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>{t.cancel}</Button>
              <Button onClick={saveDraft}>{t.save}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
