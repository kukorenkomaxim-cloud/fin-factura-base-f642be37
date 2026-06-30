// Server-only helpers for Gmail OAuth accounts and sending email.
import { createClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "./email-crypto.server";

export function getAdminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface OAuthAccountRow {
  id: string;
  user_id: string;
  provider: string;
  email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string | null;
}

/** Get a valid access token for the given account, refreshing if needed. */
export async function getValidAccessToken(account: OAuthAccountRow): Promise<string> {
  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  const now = Date.now();
  if (expiresAt > now + 30_000) {
    return decryptToken(account.access_token_encrypted);
  }
  // Refresh
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const refreshToken = decryptToken(account.refresh_token_encrypted);
  if (!refreshToken) throw new Error("No refresh token stored — reconnect Gmail");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const tokens = (await res.json()) as { access_token: string; expires_in: number };

  // Update DB
  const admin = getAdminClient();
  await admin
    .from("email_oauth_accounts")
    .update({
      access_token_encrypted: encryptToken(tokens.access_token),
      expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return tokens.access_token;
}

/** Build an RFC 2822 MIME message with a single PDF attachment, base64url-encoded for Gmail. */
export function buildGmailRawMessage(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  pdfBase64: string;
  pdfFilename: string;
}): string {
  const boundary = "----=_FincraftBoundary_" + Math.random().toString(36).slice(2);
  // Strip CR/LF from any value embedded into MIME headers to prevent header injection.
  const stripCRLF = (value: string) => value.replace(/[\r\n]/g, "");
  const safeFrom = stripCRLF(opts.from);
  const safeTo = stripCRLF(opts.to);
  const safeFilename = stripCRLF(opts.pdfFilename);
  // Encode subject as RFC 2047 if non-ASCII (also neutralizes CRLF)
  const subjectNoCRLF = stripCRLF(opts.subject);
  const encodedSubject = /[^\x20-\x7e]/.test(subjectNoCRLF)
    ? `=?UTF-8?B?${Buffer.from(subjectNoCRLF, "utf8").toString("base64")}?=`
    : subjectNoCRLF;

  // Split base64 attachment into 76-char lines per RFC
  const attachmentBody = opts.pdfBase64.match(/.{1,76}/g)?.join("\r\n") ?? opts.pdfBase64;

  const message = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.body, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "",
    `--${boundary}`,
    "Content-Type: application/pdf",
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    "",
    attachmentBody,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  // base64url for Gmail API
  return Buffer.from(message, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
