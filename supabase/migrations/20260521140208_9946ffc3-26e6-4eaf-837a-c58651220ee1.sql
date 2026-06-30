
-- 1. Add email column to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

-- 2. email_oauth_accounts
CREATE TABLE IF NOT EXISTS public.email_oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','outlook')),
  email text NOT NULL,
  access_token_encrypted text NOT NULL DEFAULT '',
  refresh_token_encrypted text NOT NULL DEFAULT '',
  expires_at timestamptz,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, email)
);

ALTER TABLE public.email_oauth_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own email account select" ON public.email_oauth_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own email account insert" ON public.email_oauth_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own email account update" ON public.email_oauth_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own email account delete" ON public.email_oauth_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER email_oauth_accounts_updated_at
  BEFORE UPDATE ON public.email_oauth_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. email_send_log
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL,
  recipient_email text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','outlook','mailto')),
  from_email text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  sent_at timestamptz,
  delivered_at timestamptz,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_send_log_document_idx ON public.email_send_log (document_id);
CREATE INDEX IF NOT EXISTS email_send_log_user_idx ON public.email_send_log (user_id);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own send log select" ON public.email_send_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own send log insert" ON public.email_send_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own send log update" ON public.email_send_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own send log delete" ON public.email_send_log FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER email_send_log_updated_at
  BEFORE UPDATE ON public.email_send_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
