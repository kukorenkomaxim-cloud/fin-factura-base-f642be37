// Server route: initiate Gmail OAuth.
// User must be signed in. We sign the userId in state and redirect to Google.
import { createFileRoute } from "@tanstack/react-router";
import { signState, verifyState } from "@/lib/email-crypto.server";

function getRedirectUri(request: Request): string {
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (override) return override;
  const url = new URL(request.url);
  return `${url.origin}/api/oauth/gmail/callback`;
}

export const Route = createFileRoute("/api/oauth/gmail/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Identify user from a short-lived, signed one-time code (not a JWT in the URL).
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) return new Response("Missing code", { status: 401 });

        const decoded = verifyState<{ uid: string; purpose: string; exp: number }>(code);
        if (
          !decoded ||
          decoded.purpose !== "gmail-oauth-start" ||
          !decoded.uid ||
          decoded.exp < Date.now()
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        if (!clientId) return new Response("GOOGLE_OAUTH_CLIENT_ID not set", { status: 500 });

        const state = signState({
          uid: decoded.uid,
          n: Math.random().toString(36).slice(2),
          exp: Date.now() + 10 * 60 * 1000,
        });

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: getRedirectUri(request),
          response_type: "code",
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
          scope: [
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/userinfo.email",
          ].join(" "),
          state,
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
          },
        });
      },
    },
  },
});
