
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS aeat_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS aeat_csv text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_response_xml text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_error_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_submitted_at timestamptz;
