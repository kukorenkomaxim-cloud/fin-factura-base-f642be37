// Client-callable server functions for email accounts and sending.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildGmailRawMessage,
  getAdminClient,
  getValidAccessToken,
} from "./email-gmail.server";

/** Mint a short-lived, signed one-time code to start Gmail OAuth without putting the JWT in the URL. */
export const createGmailOAuthCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { signState } = await import("./email-crypto.server");
    const code = signState({
      uid: context.userId,
      purpose: "gmail-oauth-start",
      n: Math.random().toString(36).slice(2),
      exp: Date.now() + 60 * 1000, // valid for 60 seconds
    });
    return { code };
  });

/** List user's connected email accounts (without exposing tokens). */
export const listEmailAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("email_oauth_accounts")
      .select("id, provider, email, is_default, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

export const setDefaultEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ accountId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("email_oauth_accounts").update({ is_default: false }).eq("user_id", userId);
    const { error } = await supabase
      .from("email_oauth_accounts")
      .update({ is_default: true })
      .eq("id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ accountId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("email_oauth_accounts").delete().eq("id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send PDF document via Gmail. */
export const sendDocumentByGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        documentId: z.string().uuid(),
        accountId: z.string().uuid(),
        to: z.string().email().max(320),
        subject: z.string().min(1).max(998).regex(/^[^\r\n]*$/, "Invalid characters in subject"),
        body: z.string().max(50_000),
        pdfBase64: z.string().min(1).max(20_000_000), // ~15MB cap
        pdfFilename: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[^\r\n]*$/, "Invalid characters in filename"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = getAdminClient();

    // Load account (with tokens) using admin client — we trust userId from middleware
    const { data: account, error: accErr } = await admin
      .from("email_oauth_accounts")
      .select("*")
      .eq("id", data.accountId)
      .eq("user_id", userId)
      .maybeSingle();
    if (accErr) throw new Error(accErr.message);
    if (!account) throw new Error("Аккаунт не найден");

    // Verify document belongs to user
    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select("id, user_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc || doc.user_id !== userId) throw new Error("Документ не найден");

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(account);
    } catch (err) {
      // Log failure
      await admin.from("email_send_log").insert({
        document_id: data.documentId,
        user_id: userId,
        recipient_email: data.to,
        from_email: account.email,
        provider: "gmail",
        subject: data.subject,
        body: data.body,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const raw = buildGmailRawMessage({
      from: account.email,
      to: data.to,
      subject: data.subject,
      body: data.body,
      pdfBase64: data.pdfBase64,
      pdfFilename: data.pdfFilename,
    });

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const text = await res.text();
      const msg = `Gmail API ${res.status}: ${text.slice(0, 300)}`;
      await admin.from("email_send_log").insert({
        document_id: data.documentId,
        user_id: userId,
        recipient_email: data.to,
        from_email: account.email,
        provider: "gmail",
        subject: data.subject,
        body: data.body,
        error: msg,
      });
      throw new Error(msg);
    }

    await admin.from("email_send_log").insert({
      document_id: data.documentId,
      user_id: userId,
      recipient_email: data.to,
      from_email: account.email,
      provider: "gmail",
      subject: data.subject,
      body: data.body,
      sent_at: new Date().toISOString(),
    });

    return { ok: true };
  });

/** Log mailto send (user opened mail client and confirmed they sent it). */
export const logMailtoSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        documentId: z.string().uuid(),
        to: z.string().email().max(320),
        subject: z.string().max(998),
        body: z.string().max(50_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("email_send_log").insert({
      document_id: data.documentId,
      user_id: userId,
      recipient_email: data.to,
      from_email: "",
      provider: "mailto",
      subject: data.subject,
      body: data.body,
      sent_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Get last send status for a document. */
export const getDocumentSendStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("email_send_log")
      .select("provider, recipient_email, sent_at, delivered_at, error, created_at")
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return { last: rows?.[0] ?? null };
  });
