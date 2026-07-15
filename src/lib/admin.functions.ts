// Admin-only server functions for the customer management panel.
// Every function verifies the caller has the 'admin' role before doing any work.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppAuth } from "@/lib/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
function genCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    if (i === 3 || i === 7 || i === 11) out += "-";
  }
  return out; // e.g. ABCD-EFGH-JKLM-NPQR
}

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_admin: boolean;
  doc_count: number;
  sandbox_count: number;
  production_count: number;
  login_count: number;
  sub_status: string | null;
  sub_plan: string | null;
  sub_valid_until: string | null;
  sub_source: string | null;
  has_access: boolean;
};

/** Lists all registered users with usage metrics. periodDays controls the login-count window. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireAppAuth])
  .inputValidator((input) =>
    z.object({ periodDays: z.number().int().min(1).max(3650).default(30) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ users: AdminUserRow[] }> => {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await assertAdmin(supabaseAdmin, context.userId);

    // 1. Auth users (email, created, last sign-in)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) throw new Error(authErr.message);
    const users = authData?.users ?? [];

    // 2. Roles
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    const adminSet = new Set((roles ?? []).map((r: { user_id: string }) => r.user_id));

    // 3. Subscriptions
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, status, plan, valid_until, source");
    const subMap = new Map(
      (subs ?? []).map((s: { user_id: string }) => [s.user_id, s]),
    );

    // 4. Documents (count + mode breakdown)
    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("user_id, created_mode");
    const docAgg = new Map<string, { total: number; sandbox: number; production: number }>();
    for (const d of docs ?? []) {
      const row = d as { user_id: string; created_mode: string | null };
      const a = docAgg.get(row.user_id) ?? { total: 0, sandbox: 0, production: 0 };
      a.total++;
      if (row.created_mode === "production") a.production++;
      else a.sandbox++;
      docAgg.set(row.user_id, a);
    }

    // 5. Login events within period
    const cutoff = new Date(Date.now() - data.periodDays * 86_400_000).toISOString();
    const { data: logins } = await supabaseAdmin
      .from("login_events")
      .select("user_id")
      .gte("created_at", cutoff);
    const loginAgg = new Map<string, number>();
    for (const l of logins ?? []) {
      const uid = (l as { user_id: string }).user_id;
      loginAgg.set(uid, (loginAgg.get(uid) ?? 0) + 1);
    }

    const now = Date.now();
    const rows: AdminUserRow[] = users.map((u) => {
      const sub = subMap.get(u.id) as
        | { status: string; plan: string; valid_until: string | null; source: string }
        | undefined;
      const agg = docAgg.get(u.id) ?? { total: 0, sandbox: 0, production: 0 };
      const isAdmin = adminSet.has(u.id);
      const subActive =
        !!sub &&
        sub.status === "active" &&
        !!sub.valid_until &&
        new Date(sub.valid_until).getTime() > now;
      return {
        user_id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        is_admin: isAdmin,
        doc_count: agg.total,
        sandbox_count: agg.sandbox,
        production_count: agg.production,
        login_count: loginAgg.get(u.id) ?? 0,
        sub_status: sub?.status ?? null,
        sub_plan: sub?.plan ?? null,
        sub_valid_until: sub?.valid_until ?? null,
        sub_source: sub?.source ?? null,
        has_access: isAdmin || subActive,
      };
    });

    rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return { users: rows };
  });

export type AdminCodeRow = {
  id: string;
  code: string;
  duration_days: number;
  plan: string;
  note: string | null;
  code_expires_at: string | null;
  created_at: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  redeemed_email: string | null;
};

/** Generates one or more free access codes. */
export const adminGenerateCodes = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .inputValidator((input) =>
    z
      .object({
        count: z.number().int().min(1).max(100).default(1),
        durationDays: z.number().int().min(1).max(3650),
        plan: z.string().trim().min(1).max(40).default("free"),
        note: z.string().trim().max(200).optional(),
        codeExpiresInDays: z.number().int().min(1).max(3650).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await assertAdmin(supabaseAdmin, context.userId);

    const codeExpiresAt = data.codeExpiresInDays
      ? new Date(Date.now() + data.codeExpiresInDays * 86_400_000).toISOString()
      : null;

    const rows = Array.from({ length: data.count }, () => ({
      code: genCode(),
      duration_days: data.durationDays,
      plan: data.plan,
      note: data.note ?? null,
      code_expires_at: codeExpiresAt,
      created_by: context.userId,
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from("access_codes")
      .insert(rows)
      .select("code");
    if (error) throw new Error(error.message);
    return { codes: (inserted ?? []).map((r: { code: string }) => r.code) };
  });

/** Lists all access codes with redeemer email. */
export const adminListCodes = createServerFn({ method: "GET" })
  .middleware([requireAppAuth])
  .handler(async ({ context }): Promise<{ codes: AdminCodeRow[] }> => {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await assertAdmin(supabaseAdmin, context.userId);

    const { data: codes, error } = await supabaseAdmin
      .from("access_codes")
      .select("id, code, duration_days, plan, note, code_expires_at, created_at, redeemed_by, redeemed_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Resolve redeemer emails
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? null]));

    const rows: AdminCodeRow[] = (codes ?? []).map((c: Omit<AdminCodeRow, "redeemed_email">) => ({
      ...c,
      redeemed_email: c.redeemed_by ? emailMap.get(c.redeemed_by) ?? null : null,
    }));
    return { codes: rows };
  });

/** Directly grants or extends a subscription for a user. */
export const adminGrantSubscription = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        durationDays: z.number().int().min(1).max(3650),
        plan: z.string().trim().min(1).max(40).default("standard"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await assertAdmin(supabaseAdmin, context.userId);

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("valid_until, status")
      .eq("user_id", data.userId)
      .maybeSingle();

    const now = Date.now();
    const existingMs =
      existing && existing.status === "active" && existing.valid_until
        ? new Date(existing.valid_until).getTime()
        : 0;
    const base = Math.max(now, existingMs);
    const newValid = new Date(base + data.durationDays * 86_400_000).toISOString();

    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: data.userId,
        status: "active",
        plan: data.plan,
        valid_until: newValid,
        source: "admin_grant",
        granted_by: context.userId,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, valid_until: newValid };
  });

export type AdminVisitorStats = {
  periodDays: number;
  totalVisits: number;
  uniqueVisitors: number;
  returningVisitors: number;
  newVisitors: number;
};

/**
 * Aggregated anonymous-visitor analytics. Reads the raw visit_events with the
 * service role and returns only counts — no visitor identifiers leave the server.
 */
export const adminVisitorStats = createServerFn({ method: "GET" })
  .middleware([requireAppAuth])
  .inputValidator((input) =>
    z.object({ periodDays: z.number().int().min(1).max(3650).default(30) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<AdminVisitorStats> => {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await assertAdmin(supabaseAdmin, context.userId);

    const cutoff = new Date(Date.now() - data.periodDays * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("visit_events")
      .select("visitor_id")
      .gte("created_at", cutoff);
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      const id = (r as { visitor_id: string }).visitor_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    let returningVisitors = 0;
    for (const n of counts.values()) if (n > 1) returningVisitors++;

    return {
      periodDays: data.periodDays,
      totalVisits: rows?.length ?? 0,
      uniqueVisitors: counts.size,
      returningVisitors,
      newVisitors: counts.size - returningVisitors,
    };
  });

/** Revokes a user's subscription (immediately blocks access). */
export const adminRevokeSubscription = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await assertAdmin(supabaseAdmin, context.userId);

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "revoked" })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
