import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { trackVisit } from "@/lib/track-visit";

/**
 * Mounts once at the app root. Records an anonymous visit (once per session)
 * for visitors who have granted analytics consent. Safe to render everywhere:
 * it does nothing without consent.
 */
export function VisitTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    void trackVisit(pathname);
    // Only the first resolved path of the session matters; trackVisit
    // self-limits to one record per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
