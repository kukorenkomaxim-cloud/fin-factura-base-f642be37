// Client-callable server functions for GDPR data portability (export) and
// account deletion (right to erasure). Each acts only on the authenticated
// caller's own data.
import { createServerFn } from "@tanstack/react-start";
import { requireAppAuth } from "@/lib/auth-middleware";

// Tables included in the data export (right to data portability).
// Sensitive secrets (e.g. encrypted email tokens) are intentionally excluded.
const EXPORT_TABLES = [
  "company_settings",
  "bank_accounts",
  "clients",
  "services",
  "documents",
] as const;

// Tables purged on account deletion, in FK-safe order.
const DELETE_TABLES = [
  "documents",
  "document_counters",
  "clients",
  "services",
  "bank_accounts",
  "email_send_log",
  "email_oauth_accounts",
  "subscriptions",
  "login_events",
  "user_roles",
  "company_settings",
] as const;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ExportPayload = {
  exportedAt: string;
  userId: string;
  email: string | null;
  data: Record<string, JsonValue[]>;
};

/** Returns all of the caller's own data as a single JSON-serializable object. */
export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireAppAuth])
  .handler(async ({ context }): Promise<ExportPayload> => {
    const { supabase, userId, claims } = context;
    const data: Record<string, JsonValue[]> = {};

    for (const table of EXPORT_TABLES) {
      const { data: rows, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId);
      if (error) throw new Error(`${table}: ${error.message}`);
      data[table] = (rows ?? []) as JsonValue[];
    }

    return {
      exportedAt: new Date().toISOString(),
      userId,
      email: (claims as { email?: string } | undefined)?.email ?? null,
      data,
    };
  });

/** Permanently deletes the caller's data and their auth account. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { userId } = context;
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;

    // 1. Remove all owned rows.
    for (const table of DELETE_TABLES) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
      // Ignore "no rows"; surface real failures.
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    // 2. Delete the auth user itself.
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(authErr.message);

    return { ok: true };
  });
