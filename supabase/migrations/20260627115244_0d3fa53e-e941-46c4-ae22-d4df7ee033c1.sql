-- Lock down the SECURITY DEFINER trigger function so it cannot be invoked
-- directly through the exposed API by anonymous or authenticated callers.
-- It is only meant to run as a trigger on public.user_roles.
REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM authenticated;

-- Defense in depth: ensure every other SECURITY DEFINER helper is not
-- directly executable by untrusted roles either.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_document_number(text) FROM PUBLIC;

-- Hardening for user_roles privilege escalation: re-assert that role
-- changes (insert/update) require the caller to already be an admin, and
-- that admins cannot bypass the WITH CHECK on UPDATE.
DROP POLICY IF EXISTS "Admins manage user roles - insert" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage user roles - update" ON public.user_roles;

CREATE POLICY "Admins manage user roles - insert"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage user roles - update"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));