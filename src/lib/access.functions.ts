// Client-callable server functions for subscription-based access control.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppAuth } from "@/lib/auth-middleware";

export type AccessInfo = {
  isAdmin: boolean;
  hasAccess: boolean;
  subscription: {
    status: string;
    plan: string;
    valid_until: string | null;
    source: string;
  } | null;
};

/** Returns the current user's access status (admin or active subscription). */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireAppAuth])
  .handler(async ({ context }): Promise<AccessInfo> => {
    const { userId } = context;
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("status, plan, valid_until, source")
      .eq("user_id", userId)
      .maybeSingle();

    const subActive =
      !!sub &&
      sub.status === "active" &&
      !!sub.valid_until &&
      new Date(sub.valid_until).getTime() > Date.now();

    return {
      isAdmin,
      hasAccess: isAdmin || subActive,
      subscription: sub ?? null,
    };
  });

/** Records a login event for usage statistics. */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("login_events").insert({ user_id: userId });
    return { ok: true };
  });

/** Redeems an access code and activates / extends the user's subscription. */
export const redeemAccessCode = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .inputValidator((input) =>
    z.object({ code: z.string().trim().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const normalized = data.code.trim().toUpperCase();

    const { data: code, error: codeErr } = await supabaseAdmin
      .from("access_codes")
      .select("id, duration_days, plan, code_expires_at, redeemed_by")
      .eq("code", normalized)
      .maybeSingle();

    if (codeErr) throw new Error(codeErr.message);
    if (!code) return { ok: false as const, reason: "not_found" };
    if (code.redeemed_by) return { ok: false as const, reason: "already_used" };
    if (code.code_expires_at && new Date(code.code_expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" };
    }

    // Compute new validity: extend from existing active subscription if any.
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("valid_until, status")
      .eq("user_id", userId)
      .maybeSingle();

    const now = Date.now();
    const existingMs =
      existing && existing.status === "active" && existing.valid_until
        ? new Date(existing.valid_until).getTime()
        : 0;
    const base = Math.max(now, existingMs);
    const newValid = new Date(base + code.duration_days * 86_400_000).toISOString();

    const { error: upErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          status: "active",
          plan: code.plan,
          valid_until: newValid,
          source: "free_code",
        },
        { onConflict: "user_id" },
      );
    if (upErr) throw new Error(upErr.message);

    const { error: markErr } = await supabaseAdmin
      .from("access_codes")
      .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
      .eq("id", code.id)
      .is("redeemed_by", null);
    if (markErr) throw new Error(markErr.message);

    return { ok: true as const, valid_until: newValid };
  });
