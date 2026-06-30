import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useLocale } from "@/hooks/use-locale";
import { redeemAccessCode } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";

const LOCALES: Record<string, string> = {
  ru: "ru-RU",
  en: "en-US",
  es: "es-ES",
  uk: "uk-UA",
};

export function SubscriptionGate({
  email,
  onRedeemed,
  onSignOut,
}: {
  email: string | undefined;
  onRedeemed: () => void;
  onSignOut: () => void;
}) {
  const { t, lang } = useLocale();
  const [code, setCode] = useState("");
  const redeem = useServerFn(redeemAccessCode);

  const mutation = useMutation({
    mutationFn: (c: string) => redeem({ data: { code: c } }),
    onSuccess: (res) => {
      if (res.ok) {
        const date = res.valid_until
          ? new Date(res.valid_until).toLocaleDateString(LOCALES[lang] ?? "en-US")
          : "";
        toast.success(t.codeActivated, { description: t.codeActivatedDesc.replace("{date}", date) });
        setCode("");
        onRedeemed();
      } else {
        const reason =
          res.reason === "not_found"
            ? t.codeNotFound
            : res.reason === "already_used"
              ? t.codeAlreadyUsed
              : t.codeExpired;
        toast.error(reason);
      }
    },
    onError: () => toast.error(t.codeActivateError),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) mutation.mutate(trimmed);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-bold">{t.accessRequiredTitle}</h1>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t.accessRequiredDesc}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="access-code">{t.enterAccessCode}</Label>
            <Input
              id="access-code"
              autoComplete="off"
              placeholder={t.accessCodePlaceholder}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-wider"
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending || !code.trim()}>
            {mutation.isPending ? t.activating : t.activateCodeBtn}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span className="truncate">{email}</span>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {t.accessSignOut}
          </Button>
        </div>
      </Card>
    </div>
  );
}
