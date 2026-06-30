-- ============ Roles ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ Subscriptions ============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  plan text NOT NULL DEFAULT 'standard',
  valid_until timestamptz,
  source text NOT NULL DEFAULT 'admin_grant' CHECK (source IN ('paid','free_code','admin_grant')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Access codes ============
CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  plan text NOT NULL DEFAULT 'free',
  note text,
  code_expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
-- No policies for normal users: access codes are managed only via secured server functions (service role).

-- ============ Login events ============
CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_events_user_created ON public.login_events (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own login events"
  ON public.login_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own login events"
  ON public.login_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============ Access helper ============
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = _user_id
        AND status = 'active'
        AND valid_until IS NOT NULL
        AND valid_until > now()
    )
$$;

-- ============ Assign default 'user' role on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============ Seed: owner is admin ============
INSERT INTO public.user_roles (user_id, role)
VALUES ('4ba75de7-31a3-46f5-8e86-fe7754d8c4f1', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;