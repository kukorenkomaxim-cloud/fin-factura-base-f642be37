export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          code_expires_at: string | null
          created_at: string
          created_by: string
          duration_days: number
          id: string
          note: string | null
          plan: string
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          code: string
          code_expires_at?: string | null
          created_at?: string
          created_by: string
          duration_days: number
          id?: string
          note?: string | null
          plan?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          code?: string
          code_expires_at?: string | null
          created_at?: string
          created_by?: string
          duration_days?: number
          id?: string
          note?: string | null
          plan?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          swift: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          swift?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          swift?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_line1: string
          address_line2: string
          country: string
          created_at: string
          email: string
          id: string
          name: string
          tax_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string
          address_line2?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          tax_number?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          tax_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address_line1: string
          address_line2: string
          country: string
          created_at: string
          default_currency: string
          default_language: string
          id: string
          name: string
          tax_number: string
          updated_at: string
          user_id: string
          verifactu_mode: string
        }
        Insert: {
          address_line1?: string
          address_line2?: string
          country?: string
          created_at?: string
          default_currency?: string
          default_language?: string
          id?: string
          name?: string
          tax_number?: string
          updated_at?: string
          user_id: string
          verifactu_mode?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string
          country?: string
          created_at?: string
          default_currency?: string
          default_language?: string
          id?: string
          name?: string
          tax_number?: string
          updated_at?: string
          user_id?: string
          verifactu_mode?: string
        }
        Relationships: []
      }
      document_counters: {
        Row: {
          doc_type: string
          last_value: number
          user_id: string
        }
        Insert: {
          doc_type: string
          last_value?: number
          user_id: string
        }
        Update: {
          doc_type?: string
          last_value?: number
          user_id?: string
        }
        Relationships: []
      }
      document_number_formats: {
        Row: {
          created_at: string
          created_mode: string
          doc_type: string
          first_number: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_mode: string
          doc_type: string
          first_number?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_mode?: string
          doc_type?: string
          first_number?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          aeat_anulacion_csv: string
          aeat_anulacion_error: string
          aeat_anulacion_hash: string
          aeat_anulacion_response_xml: string
          aeat_anulacion_signed_xml: string
          aeat_anulacion_status: string
          aeat_anulacion_submitted_at: string | null
          aeat_csv: string
          aeat_error_message: string
          aeat_last_attempt_at: string | null
          aeat_last_attempt_status: string
          aeat_response_xml: string
          aeat_status: string
          aeat_submitted_at: string | null
          amount_net: number
          amount_net_eur: number
          amount_total: number
          amount_total_eur: number
          annulled_at: string | null
          bank_account_id: string | null
          bank_account_number: string
          bank_label: string
          bank_name: string
          bank_swift: string
          client_address_line1: string
          client_address_line2: string
          client_country: string
          client_id: string | null
          client_name: string
          client_tax_number: string
          created_at: string
          created_mode: string
          currency: string
          doc_month: number
          doc_type: string
          doc_year: number
          exchange_rate: number
          exchange_rate_date: string | null
          exchange_rate_source: string
          formatted_number: string
          id: string
          is_annulled: boolean
          is_rectifying: boolean
          issue_date: string
          issuer_address_line1: string
          issuer_address_line2: string
          issuer_country: string
          issuer_name: string
          issuer_tax_number: string
          language: string
          period_end: string | null
          period_start: string | null
          previous_hash: string
          rectification_method: string
          rectification_reason: string
          rectification_type: string
          rectified_base: number
          rectified_invoice_date: string | null
          rectified_invoice_id: string | null
          rectified_invoice_number: string
          rectified_vat: number
          seq_number: number
          service_id: string | null
          service_name: string
          updated_at: string
          user_id: string
          vat_amount: number
          vat_amount_eur: number
          vat_rate: number
          verifactu_hash: string
          verifactu_mode: string | null
          verifactu_signed_at: string | null
          verifactu_signed_xml: string
        }
        Insert: {
          aeat_anulacion_csv?: string
          aeat_anulacion_error?: string
          aeat_anulacion_hash?: string
          aeat_anulacion_response_xml?: string
          aeat_anulacion_signed_xml?: string
          aeat_anulacion_status?: string
          aeat_anulacion_submitted_at?: string | null
          aeat_csv?: string
          aeat_error_message?: string
          aeat_last_attempt_at?: string | null
          aeat_last_attempt_status?: string
          aeat_response_xml?: string
          aeat_status?: string
          aeat_submitted_at?: string | null
          amount_net?: number
          amount_net_eur?: number
          amount_total?: number
          amount_total_eur?: number
          annulled_at?: string | null
          bank_account_id?: string | null
          bank_account_number?: string
          bank_label?: string
          bank_name?: string
          bank_swift?: string
          client_address_line1?: string
          client_address_line2?: string
          client_country?: string
          client_id?: string | null
          client_name?: string
          client_tax_number?: string
          created_at?: string
          created_mode?: string
          currency?: string
          doc_month: number
          doc_type: string
          doc_year: number
          exchange_rate?: number
          exchange_rate_date?: string | null
          exchange_rate_source?: string
          formatted_number: string
          id?: string
          is_annulled?: boolean
          is_rectifying?: boolean
          issue_date?: string
          issuer_address_line1?: string
          issuer_address_line2?: string
          issuer_country?: string
          issuer_name?: string
          issuer_tax_number?: string
          language?: string
          period_end?: string | null
          period_start?: string | null
          previous_hash?: string
          rectification_method?: string
          rectification_reason?: string
          rectification_type?: string
          rectified_base?: number
          rectified_invoice_date?: string | null
          rectified_invoice_id?: string | null
          rectified_invoice_number?: string
          rectified_vat?: number
          seq_number: number
          service_id?: string | null
          service_name?: string
          updated_at?: string
          user_id: string
          vat_amount?: number
          vat_amount_eur?: number
          vat_rate?: number
          verifactu_hash?: string
          verifactu_mode?: string | null
          verifactu_signed_at?: string | null
          verifactu_signed_xml?: string
        }
        Update: {
          aeat_anulacion_csv?: string
          aeat_anulacion_error?: string
          aeat_anulacion_hash?: string
          aeat_anulacion_response_xml?: string
          aeat_anulacion_signed_xml?: string
          aeat_anulacion_status?: string
          aeat_anulacion_submitted_at?: string | null
          aeat_csv?: string
          aeat_error_message?: string
          aeat_last_attempt_at?: string | null
          aeat_last_attempt_status?: string
          aeat_response_xml?: string
          aeat_status?: string
          aeat_submitted_at?: string | null
          amount_net?: number
          amount_net_eur?: number
          amount_total?: number
          amount_total_eur?: number
          annulled_at?: string | null
          bank_account_id?: string | null
          bank_account_number?: string
          bank_label?: string
          bank_name?: string
          bank_swift?: string
          client_address_line1?: string
          client_address_line2?: string
          client_country?: string
          client_id?: string | null
          client_name?: string
          client_tax_number?: string
          created_at?: string
          created_mode?: string
          currency?: string
          doc_month?: number
          doc_type?: string
          doc_year?: number
          exchange_rate?: number
          exchange_rate_date?: string | null
          exchange_rate_source?: string
          formatted_number?: string
          id?: string
          is_annulled?: boolean
          is_rectifying?: boolean
          issue_date?: string
          issuer_address_line1?: string
          issuer_address_line2?: string
          issuer_country?: string
          issuer_name?: string
          issuer_tax_number?: string
          language?: string
          period_end?: string | null
          period_start?: string | null
          previous_hash?: string
          rectification_method?: string
          rectification_reason?: string
          rectification_type?: string
          rectified_base?: number
          rectified_invoice_date?: string | null
          rectified_invoice_id?: string | null
          rectified_invoice_number?: string
          rectified_vat?: number
          seq_number?: number
          service_id?: string | null
          service_name?: string
          updated_at?: string
          user_id?: string
          vat_amount?: number
          vat_amount_eur?: number
          vat_rate?: number
          verifactu_hash?: string
          verifactu_mode?: string | null
          verifactu_signed_at?: string | null
          verifactu_signed_xml?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      email_oauth_accounts: {
        Row: {
          access_token_encrypted: string
          created_at: string
          email: string
          expires_at: string | null
          id: string
          is_default: boolean
          provider: string
          refresh_token_encrypted: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          is_default?: boolean
          provider: string
          refresh_token_encrypted?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          is_default?: boolean
          provider?: string
          refresh_token_encrypted?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          body: string
          created_at: string
          delivered_at: string | null
          document_id: string
          error: string
          from_email: string
          id: string
          provider: string
          recipient_email: string
          sent_at: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          delivered_at?: string | null
          document_id: string
          error?: string
          from_email?: string
          id?: string
          provider: string
          recipient_email: string
          sent_at?: string | null
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          delivered_at?: string | null
          document_id?: string
          error?: string
          from_email?: string
          id?: string
          provider?: string
          recipient_email?: string
          sent_at?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      login_events: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          name_en: string
          name_es: string
          name_ru: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          name_en?: string
          name_es?: string
          name_ru?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          name_en?: string
          name_es?: string
          name_ru?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          plan: string
          source: string
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          plan?: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          plan?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit_events: {
        Row: {
          created_at: string
          id: string
          path: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_document_number: { Args: { _doc_type: string }; Returns: number }
      release_document_number: { Args: { _doc_type: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
