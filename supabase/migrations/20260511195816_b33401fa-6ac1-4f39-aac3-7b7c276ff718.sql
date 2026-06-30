ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_annulled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annulled_at timestamptz,
  ADD COLUMN IF NOT EXISTS aeat_anulacion_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS aeat_anulacion_csv text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_anulacion_signed_xml text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_anulacion_response_xml text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_anulacion_error text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_anulacion_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS aeat_anulacion_hash text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_documents_rectified_invoice_id
  ON public.documents (rectified_invoice_id)
  WHERE rectified_invoice_id IS NOT NULL;