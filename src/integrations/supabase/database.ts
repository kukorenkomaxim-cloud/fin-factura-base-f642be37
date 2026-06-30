// Manually maintained Supabase Database types.
// We use a custom (non-Lovable-Cloud) Supabase project, so the auto-generated
// types.ts is not produced. Code imports `Database` from "@/integrations/supabase/types"
// which is re-exported from this file via a re-export shim.
//
// If you change your schema in Supabase, regenerate by running:
//   npx supabase gen types typescript --project-id <id> > src/integrations/supabase/database.ts
// and keep the export name as `Database`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string;
          code_expires_at: string | null;
          created_at: string;
          created_by: string;
          duration_days: number;
          id: string;
          note: string | null;
          plan: string;
          redeemed_at: string | null;
          redeemed_by: string | null;
        };
        Insert: {
          code: string;
          code_expires_at?: string | null;
          created_at?: string;
          created_by: string;
          duration_days: number;
          id?: string;
          note?: string | null;
          plan?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
        };
        Update: {
          code?: string;
          code_expires_at?: string | null;
          created_at?: string;
          created_by?: string;
          duration_days?: number;
          id?: string;
          note?: string | null;
          plan?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          account_number: string;
          bank_name: string;
          created_at: string;
          id: string;
          is_default: boolean;
          label: string;
          swift: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_number: string;
          bank_name: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label: string;
          swift?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_number?: string;
          bank_name?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          swift?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    } & Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: unknown[] }>;
    Views: { [_ in never]: never };
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
