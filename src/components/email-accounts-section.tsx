import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/hooks/use-locale";
import {
  listEmailAccounts,
  setDefaultEmailAccount,
  disconnectEmailAccount,
  createGmailOAuthCode,
} from "@/lib/email.functions";

interface AccountRow {
  id: string;
  provider: string;
  email: string;
  is_default: boolean;
}

export function EmailAccountsSection() {
  const { t } = useLocale();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const listFn = useServerFn(listEmailAccounts);
  const setDefaultFn = useServerFn(setDefaultEmailAccount);
  const disconnectFn = useServerFn(disconnectEmailAccount);
  const createCodeFn = useServerFn(createGmailOAuthCode);

  async function load() {
    try {
      const res = await listFn();
      setAccounts(res.accounts as AccountRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.emailLoadError);
      setAccounts([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectGmail() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        toast.error(t.emailLoginAgain);
        return;
      }
      // Exchange the session for a short-lived, single-use code so the JWT never appears in a URL.
      const { code } = await createCodeFn();
      const url = `/api/oauth/gmail/start?code=${encodeURIComponent(code)}`;
      const popup = window.open(url, "gmail-oauth", "width=520,height=680,left=200,top=100");
      if (!popup) {
        toast.error(t.emailPopupBlocked);
        return;
      }

      const handler = (ev: MessageEvent) => {
        // Only trust messages from our own origin.
        if (ev.origin !== window.location.origin) return;
        if (!ev.data || typeof ev.data !== "object") return;
        if (ev.data.type === "gmail-oauth-ok") {
          toast.success(t.emailGmailConnected.replace("{email}", ev.data.email));
          window.removeEventListener("message", handler);
          load();
        } else if (ev.data.type === "gmail-oauth-error") {
          toast.error(ev.data.message || t.emailConnectError);
          window.removeEventListener("message", handler);
        }
      };
      window.addEventListener("message", handler);


      // Cleanup if popup closed without postMessage
      const closeWatch = setInterval(() => {
        if (popup.closed) {
          clearInterval(closeWatch);
          window.removeEventListener("message", handler);
          load();
        }
      }, 500);
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    try {
      await setDefaultFn({ data: { accountId: id } });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.saveError);
    }
  }

  async function disconnect(id: string, email: string) {
    if (!confirm(t.emailDisconnectConfirm.replace("{email}", email))) return;
    try {
      await disconnectFn({ data: { accountId: id } });
      toast.success(t.emailDisconnected);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.saveError);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{t.emailSectionTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.emailSectionDesc}
          </p>
        </div>
        <Button size="sm" onClick={connectGmail} disabled={busy}>
          <Mail className="mr-2 h-4 w-4" />
          {t.connectGmailBtn}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {accounts === null && <p className="text-sm text-muted-foreground">{t.loading}</p>}
        {accounts?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.noEmailAccounts}</p>
        )}
        {accounts?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{a.email}</div>
                <div className="text-xs text-muted-foreground capitalize">{a.provider}</div>
              </div>
              {a.is_default && (
                <Badge variant="secondary" className="ml-2">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t.emailDefault}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!a.is_default && (
                <Button size="sm" variant="ghost" onClick={() => makeDefault(a.id)}>
                  {t.emailMakeDefault}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => disconnect(a.id, a.email)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        {t.emailGmailPermissionNote}
      </p>
    </Card>
  );
}
