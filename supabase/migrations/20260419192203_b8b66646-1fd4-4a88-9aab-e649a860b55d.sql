
-- ============================================================
-- INVOICING APP — schema
-- ============================================================

-- Generic timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- COMPANY SETTINGS (issuer / "Мои реквизиты") — one row per user
-- ============================================================
CREATE TABLE public.company_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT '',
  tax_number    TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  default_language TEXT NOT NULL DEFAULT 'ru' CHECK (default_language IN ('ru','en','es')),
  default_currency TEXT NOT NULL DEFAULT 'EUR' CHECK (default_currency IN ('EUR','USD','RUB')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own company select" ON public.company_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own company insert" ON public.company_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own company update" ON public.company_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own company delete" ON public.company_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_company_settings_updated
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create empty company_settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.company_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BANK ACCOUNTS — many per user
-- ============================================================
CREATE TABLE public.bank_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,                  -- short name to pick from
  bank_name    TEXT NOT NULL,
  account_number TEXT NOT NULL,                -- IBAN / account
  swift        TEXT NOT NULL DEFAULT '',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own bank select" ON public.bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own bank insert" ON public.bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bank update" ON public.bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own bank delete" ON public.bank_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_bank_accounts_updated
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SERVICES — many per user
-- ============================================================
CREATE TABLE public.services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own service select" ON public.services FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own service insert" ON public.services FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own service update" ON public.services FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own service delete" ON public.services FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_services_updated
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CLIENTS — many per user
-- ============================================================
CREATE TABLE public.clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  tax_number    TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own client select" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own client insert" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own client update" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own client delete" ON public.clients FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_clients_updated
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- DOCUMENT COUNTERS — per user, per type ("proforma" / "factura")
-- monotonic, never reused
-- ============================================================
CREATE TABLE public.document_counters (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type   TEXT NOT NULL CHECK (doc_type IN ('proforma','factura')),
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, doc_type)
);
ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own counter select" ON public.document_counters FOR SELECT USING (auth.uid() = user_id);
-- writes only via SECURITY DEFINER function below

CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_next INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _doc_type NOT IN ('proforma','factura') THEN
    RAISE EXCEPTION 'Invalid doc_type';
  END IF;

  INSERT INTO public.document_counters (user_id, doc_type, last_value)
  VALUES (v_user, _doc_type, 1)
  ON CONFLICT (user_id, doc_type)
  DO UPDATE SET last_value = public.document_counters.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;

-- ============================================================
-- DOCUMENTS — invoices and proformas
-- ============================================================
CREATE TABLE public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('proforma','factura')),
  seq_number      INTEGER NOT NULL,            -- порядковый номер (sequence)
  doc_month       INTEGER NOT NULL,            -- месяц формирования (1-12)
  doc_year        INTEGER NOT NULL,            -- год формирования (4 digits)
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  formatted_number TEXT NOT NULL,              -- e.g. "Proforma Invois 01-2026-001"

  -- snapshot of client (so editing client later doesn't break old PDFs)
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name     TEXT NOT NULL DEFAULT '',
  client_tax_number TEXT NOT NULL DEFAULT '',
  client_address_line1 TEXT NOT NULL DEFAULT '',
  client_address_line2 TEXT NOT NULL DEFAULT '',

  -- snapshot of issuer
  issuer_name     TEXT NOT NULL DEFAULT '',
  issuer_tax_number TEXT NOT NULL DEFAULT '',
  issuer_address_line1 TEXT NOT NULL DEFAULT '',
  issuer_address_line2 TEXT NOT NULL DEFAULT '',

  -- service snapshot
  service_id      UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name    TEXT NOT NULL DEFAULT '',

  -- period
  period_start    DATE,
  period_end      DATE,

  -- financials
  amount_net      NUMERIC(14,2) NOT NULL DEFAULT 0, -- net (without VAT)
  vat_rate        NUMERIC(5,2)  NOT NULL DEFAULT 0, -- e.g. 21.00
  vat_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_total    NUMERIC(14,2) NOT NULL DEFAULT 0, -- net + VAT
  currency        TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR','USD','RUB')),

  -- bank snapshot
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  bank_label      TEXT NOT NULL DEFAULT '',
  bank_name       TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_swift      TEXT NOT NULL DEFAULT '',

  language        TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru','en','es')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, doc_type, seq_number)
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own doc select" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own doc insert" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own doc update" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own doc delete" ON public.documents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_documents_updated
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_documents_user_type ON public.documents(user_id, doc_type);
CREATE INDEX idx_documents_user_year_month ON public.documents(user_id, doc_year, doc_month);
