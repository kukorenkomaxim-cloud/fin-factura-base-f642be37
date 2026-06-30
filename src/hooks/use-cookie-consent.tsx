import { useCallback, useEffect, useState } from "react";

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  // ISO timestamp of when the choice was made
  decidedAt: string;
};

const STORAGE_KEY = "cookie-consent";
const EVENT = "cookie-consent-change";

function read(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (!parsed.decidedAt) return null;
    return {
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
      decidedAt: parsed.decidedAt,
    };
  } catch {
    return null;
  }
}

/** Persist consent and notify all listeners in this tab. */
export function setCookieConsent(value: { analytics: boolean; marketing: boolean }) {
  const payload: CookieConsent = {
    necessary: true,
    analytics: value.analytics,
    marketing: value.marketing,
    decidedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  // If analytics consent is withdrawn, drop the anonymous analytics identifier.
  if (!value.analytics) {
    try {
      window.localStorage.removeItem("analytics-visitor-id");
      window.sessionStorage.removeItem("analytics-visit-logged");
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  // Avoid SSR/client hydration mismatch: only resolve after mount.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(read());
    setReady(true);
    const onChange = () => setConsent(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const save = useCallback((value: { analytics: boolean; marketing: boolean }) => {
    setCookieConsent(value);
  }, []);

  return { consent, ready, save };
}

/** Convenience check used by future analytics/marketing integrations. */
export function hasConsent(category: "analytics" | "marketing"): boolean {
  const c = read();
  return !!c && !!c[category];
}
