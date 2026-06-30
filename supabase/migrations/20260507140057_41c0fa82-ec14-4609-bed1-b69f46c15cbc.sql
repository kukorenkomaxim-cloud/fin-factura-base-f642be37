ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exchange_rate_date date,
  ADD COLUMN IF NOT EXISTS exchange_rate_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount_net_eur numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount_eur numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_total_eur numeric NOT NULL DEFAULT 0;