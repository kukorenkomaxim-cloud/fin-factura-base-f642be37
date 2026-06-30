ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_rectifying boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rectification_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rectification_method text NOT NULL DEFAULT 'I',
  ADD COLUMN IF NOT EXISTS rectification_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rectified_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS rectified_invoice_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rectified_invoice_date date,
  ADD COLUMN IF NOT EXISTS rectified_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rectified_vat numeric NOT NULL DEFAULT 0;