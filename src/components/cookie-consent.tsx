import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/hooks/use-locale";
import { useCookieConsent } from "@/hooks/use-cookie-consent";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function CookieConsentBanner() {
  const { t } = useLocale();
  const { consent, ready, save } = useCookieConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Don't render until we know (avoids hydration flash) or once a choice exists.
  if (!ready || consent) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-lg border bg-card p-4 shadow-lg">
        <h2 className="font-semibold text-foreground">{t.cookieTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.cookieDesc}{" "}
          <Link to="/legal/cookies" className="font-medium text-primary hover:underline">
            {t.legalCookies}
          </Link>
        </p>

        {showSettings && (
          <div className="mt-4 space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t.cookieNecessary}</p>
                <p className="text-xs text-muted-foreground">{t.cookieNecessaryDesc}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{t.cookieAlwaysOn}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t.cookieAnalytics}</p>
                <p className="text-xs text-muted-foreground">{t.cookieAnalyticsDesc}</p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t.cookieMarketing}</p>
                <p className="text-xs text-muted-foreground">{t.cookieMarketingDesc}</p>
              </div>
              <Switch checked={marketing} onCheckedChange={setMarketing} />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => save({ analytics: true, marketing: true })}>
            {t.cookieAcceptAll}
          </Button>
          <Button variant="outline" onClick={() => save({ analytics: false, marketing: false })}>
            {t.cookieRejectAll}
          </Button>
          {showSettings ? (
            <Button variant="secondary" onClick={() => save({ analytics, marketing })}>
              {t.cookieSavePrefs}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setShowSettings(true)}>
              {t.cookieCustomize}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
