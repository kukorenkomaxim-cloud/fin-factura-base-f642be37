import { supabase } from "@/integrations/supabase/client";
import { hasConsent } from "@/hooks/use-cookie-consent";

const VISITOR_KEY = "analytics-visitor-id";
const SESSION_KEY = "analytics-visit-logged";

/**
 * Returns the anonymous analytics visitor id, creating one if needed.
 * The id is a random UUID with no link to any personal data. It is only
 * created/stored when the user has granted analytics consent.
 */
function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Records an anonymous visit, at most once per browser session.
 * No-op unless the visitor granted analytics consent.
 */
export async function trackVisit(path: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!hasConsent("analytics")) return;

  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return;
  } catch {
    /* ignore */
  }

  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;

  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }

  try {
    await supabase.from("visit_events").insert({ visitor_id: visitorId, path });
  } catch {
    /* best-effort analytics: never block the UI */
  }
}

/** Removes the anonymous analytics identifier (e.g. when consent is withdrawn). */
export function clearVisitorId() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VISITOR_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
