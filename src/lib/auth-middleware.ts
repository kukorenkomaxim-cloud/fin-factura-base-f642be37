import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://idscnhzmrwttfmdkrhtc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkc2NuaHptcnd0dGZtZGtyaHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTkxNjcsImV4cCI6MjA5ODEzNTE2N30.X4gkqBLY0N9yhPE0kLV90cn-6a_6Ip02t0VJzNcB_so";

export const requireAppAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();

  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Unauthorized: No authorization header provided");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token || token.split(".").length !== 3) {
    throw new Error("Unauthorized: Invalid token");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Validate the token directly with the auth server (works for any signing key type).
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    console.error("[requireAppAuth] token validation failed:", error?.message);
    throw new Error(`Unauthorized: Invalid token (${error?.message ?? "no user"})`);
  }

  return next({
    context: {
      supabase,
      userId: data.user.id,
      claims: { sub: data.user.id, email: data.user.email },
    },
  });
});