ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS aeat_last_attempt_status text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aeat_last_attempt_at timestamptz;

COMMENT ON COLUMN public.documents.aeat_last_attempt_status IS
  'Local journal of the last AEAT submit attempt by the client. NOT an AEAT response. Values: '''' (no failed attempt) | ''timeout'' | ''network_error'' | ''unknown_error''. Cleared on successful submit.';
COMMENT ON COLUMN public.documents.aeat_last_attempt_at IS
  'Timestamp of the last AEAT submit attempt recorded by the client. Cleared on successful submit.';