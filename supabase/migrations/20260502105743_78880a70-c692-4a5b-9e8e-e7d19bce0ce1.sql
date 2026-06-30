ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS verifactu_mode TEXT NOT NULL DEFAULT 'sandbox'
  CHECK (verifactu_mode IN ('sandbox','production'));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS verifactu_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verifactu_signed_xml TEXT NOT NULL DEFAULT '';