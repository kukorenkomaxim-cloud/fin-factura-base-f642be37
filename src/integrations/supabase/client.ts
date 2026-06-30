import { createClient } from "@supabase/supabase-js";

// Публикуемые (publishable / anon) значения — безопасно держать в коде.
// Защита данных обеспечивается через Row Level Security в Supabase.
const SUPABASE_URL = "https://idscnhzmrwttfmdkrhtc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkc2NuaHptcnd0dGZtZGtyaHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTkxNjcsImV4cCI6MjA5ODEzNTE2N30.X4gkqBLY0N9yhPE0kLV90cn-6a_6Ip02t0VJzNcB_so";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
