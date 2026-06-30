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
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES, countryNameKey } from "@/lib/countries";
import { EmailAccountsSection } from "@/components/email-accounts-section";
import { DataManagementSection } from "@/components/data-management-section";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

interface CompanySettings {
  id: string;
  name: string;
  tax_number: string;
  address_line1: string;
  address_line2: string;
  country: string;
  default_language: "ru" | "en" | "es";
  default_currency: "EUR" | "USD" | "RUB";
  verifactu_mode: "sandbox" | "production";
}

interface BankAccount {
  id: string;
  label: string;
  bank_name: string;
  account_number: string;
  swift: string;
}

function SettingsPage() {
  const { user } = useAuth();
  const { t, lang } = useLocale();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const countryKey = countryNameKey(lang);
  const sortedCountries = useMemo(() => {
    return [...COUNTRIES].sort((a, b) => a[countryKey].localeCompare(b[countryKey], countryKey));
  }, [countryKey]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: c } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
    if (c) setCompany(c as CompanySettings);
    const { data: b } = await supabase.from("bank_accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    setBanks((b ?? []) as BankAccount[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function saveCompany() {
    if (!company || !user) return;
    const { error } = await supabase.from("company_settings").update({
      name: company.name, tax_number: company.tax_number,
      address_line1: company.address_line1, address_line2: company.address_line2,
      country: company.country,
      default_language: company.default_language, default_currency: company.default_currency,

    }).eq("user_id", user.id);
    if (error) toast.error(t.saveError, { description: error.message });
    else toast.success(t.settingsSaved);
  }

  async function addBank() {
    if (!user) return;
    const { error } = await supabase.from("bank_accounts").insert({ user_id: user.id, label: "", bank_name: "", account_number: "", swift: "" });
    if (error) toast.error(error.message);
    else load();
  }

  async function saveBank(b: BankAccount) {
    const { error } = await supabase.from("bank_accounts").update({ label: b.label, bank_name: b.bank_name, account_number: b.account_number, swift: b.swift }).eq("id", b.id);
    if (error) toast.error(error.message);
    else toast.success(t.saved);
  }

  async function deleteBank(id: string) {
    if (!confirm(t.deleteBankConfirm)) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  if (loading || !company) return <div>{t.loading}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.settingsTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.settingsSubtitle}</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">{t.companySection}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>{t.companyName}</Label>
            <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t.taxNumber}</Label>
            <Input value={company.tax_number} onChange={(e) => setCompany({ ...company, tax_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t.addressLine1}</Label>
            <Input value={company.address_line1} onChange={(e) => setCompany({ ...company, address_line1: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t.addressLine2}</Label>
            <Input value={company.address_line2} onChange={(e) => setCompany({ ...company, address_line2: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t.companyCountry}</Label>
            <Select value={company.country || ""} onValueChange={(v) => setCompany({ ...company, country: v })}>
              <SelectTrigger><SelectValue placeholder={t.selectCountry} /></SelectTrigger>
              <SelectContent>
                {sortedCountries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c[countryKey]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.defaultLanguage}</Label>
            <Select value={company.default_language} onValueChange={(v) => setCompany({ ...company, default_language: v as CompanySettings["default_language"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">{t.langRu}</SelectItem>
                <SelectItem value="en">{t.langEn}</SelectItem>
                <SelectItem value="es">{t.langEs}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.defaultCurrency}</Label>
            <Select value={company.default_currency} onValueChange={(v) => setCompany({ ...company, default_currency: v as CompanySettings["default_currency"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR €</SelectItem>
                <SelectItem value="USD">USD $</SelectItem>
                <SelectItem value="RUB">RUB ₽</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-6">
          <Button onClick={saveCompany}>{t.save}</Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t.bankSection}</h2>
          <Button size="sm" onClick={addBank}>
            <Plus className="mr-1 h-4 w-4" /> {t.addBankAccount}
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {banks.length === 0 && <p className="text-sm text-muted-foreground">{t.noBanksYet}</p>}
          {banks.map((b) => (
            <div key={b.id} className="rounded-md border p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.bankLabel}</Label>
                  <Input value={b.label} onChange={(e) => setBanks(banks.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))} />
                </div>
                <div className="space-y-2">
                  <Label>{t.bankName}</Label>
                  <Input value={b.bank_name} onChange={(e) => setBanks(banks.map((x) => (x.id === b.id ? { ...x, bank_name: e.target.value } : x)))} />
                </div>
                <div className="space-y-2">
                  <Label>{t.bankIban}</Label>
                  <Input value={b.account_number} onChange={(e) => setBanks(banks.map((x) => (x.id === b.id ? { ...x, account_number: e.target.value } : x)))} />
                </div>
                <div className="space-y-2">
                  <Label>{t.bankSwift}</Label>
                  <Input value={b.swift} onChange={(e) => setBanks(banks.map((x) => (x.id === b.id ? { ...x, swift: e.target.value } : x)))} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => saveBank(b)}>{t.save}</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteBank(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <EmailAccountsSection />




      <DataManagementSection />
    </div>
  );
}
