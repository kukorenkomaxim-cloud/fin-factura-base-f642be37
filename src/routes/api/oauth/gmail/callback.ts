// Server route: Google OAuth callback.
// Exchanges code for tokens and stores them encrypted. Returns HTML that
// closes the popup and notifies the opener window.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { encryptToken, verifyState } from "@/lib/email-crypto.server";

function getRedirectUri(request: Request): string {
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (override) return override;
  const url = new URL(request.url);
  return `${url.origin}/api/oauth/gmail/callback`;
}

function popupResponse(
  status: "ok" | "error",
  message: string,
  email = "",
  targetOrigin = "",
): Response {
  const safeMsg = message.replace(/</g, "&lt;");
  const safeEmail = email.replace(/</g, "&lt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${status === "ok" ? "Подключено" : "Ошибка"}</title></head>
<body style="font-family:system-ui;padding:24px;background:#f8fafc">
<div style="max-width:480px;margin:40px auto;padding:24px;border-radius:12px;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<h2 style="margin:0 0 8px 0;color:${status === "ok" ? "#059669" : "#dc2626"}">${status === "ok" ? "✓ Gmail подключён" : "✗ Ошибка"}</h2>
<p style="color:#475569;margin:8px 0">${safeMsg}</p>
${safeEmail ? `<p style="color:#0f172a;font-weight:600">${safeEmail}</p>` : ""}
<p style="color:#94a3b8;font-size:13px;margin-top:16px">Это окно закроется автоматически.</p>
</div>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({ type: "gmail-oauth-${status}", message: ${JSON.stringify(message)}, email: ${JSON.stringify(email)} }, ${JSON.stringify(targetOrigin || "/")});
  }
} catch(e) {}
setTimeout(function(){ try { window.close(); } catch(e){} }, 1500);
</script></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const Route = createFileRoute("/api/oauth/gmail/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const appOrigin = url.origin;
        const reply = (status: "ok" | "error", message: string, email = "") =>
          popupResponse(status, message, email, appOrigin);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        if (oauthError) return reply("error", `Google: ${oauthError}`);
        if (!code || !state) return reply("error", "Отсутствует code или state");

        const decoded = verifyState<{ uid: string; exp: number }>(state);
        if (!decoded) return reply("error", "Недействительный state (возможно, истёк)");
        if (decoded.exp < Date.now()) return reply("error", "Истёкший state — попробуйте подключиться заново");

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) return reply("error", "Google OAuth не настроен на сервере");

        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: getRedirectUri(request),
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const text = await tokenRes.text();
          return reply("error", `Обмен code на токен: ${tokenRes.status} ${text.slice(0, 200)}`);
        }
        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
        };

        // Get user email
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!userInfoRes.ok) {
          return reply("error", `Не удалось получить email: ${userInfoRes.status}`);
        }
        const userInfo = (await userInfoRes.json()) as { email: string };

        // Store encrypted tokens using service-role client (we already verified uid via signed state)
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

        const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

        // Check if an existing account with same email exists for this user
        const { data: existing } = await supabase
          .from("email_oauth_accounts")
          .select("id")
          .eq("user_id", decoded.uid)
          .eq("provider", "gmail")
          .eq("email", userInfo.email)
          .maybeSingle();

        // Check if user has any accounts (to set first one as default)
        const { count } = await supabase
          .from("email_oauth_accounts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", decoded.uid);

        const isFirst = (count ?? 0) === 0;

        const payload = {
          user_id: decoded.uid,
          provider: "gmail",
          email: userInfo.email,
          access_token_encrypted: encryptToken(tokens.access_token),
          refresh_token_encrypted: tokens.refresh_token
            ? encryptToken(tokens.refresh_token)
            : existing
              ? undefined
              : "",
          expires_at: expiresAt,
          is_default: isFirst || !!existing,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          // Keep existing refresh_token if Google didn't return a new one
          const updatePayload: Record<string, unknown> = { ...payload };
          if (updatePayload.refresh_token_encrypted === undefined) delete updatePayload.refresh_token_encrypted;
          delete updatePayload.user_id;
          await supabase.from("email_oauth_accounts").update(updatePayload).eq("id", existing.id);
        } else {
          if (!tokens.refresh_token) {
            return reply(
              "error",
              "Google не вернул refresh_token. Отзовите доступ в Google Account → Security → Third-party access и подключитесь заново.",
            );
          }
          await supabase.from("email_oauth_accounts").insert(payload);
        }

        return reply("ok", "Gmail успешно подключён.", userInfo.email);
      },
    },
  },
});
