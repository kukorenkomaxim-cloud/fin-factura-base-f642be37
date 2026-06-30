-- access_codes: explicit admin-only management. Regular/anon users get no access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_codes TO authenticated;
GRANT ALL ON public.access_codes TO service_role;

CREATE POLICY "Admins manage access codes - select"
  ON public.access_codes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage access codes - insert"
  ON public.access_codes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage access codes - update"
  ON public.access_codes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage access codes - delete"
  ON public.access_codes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: explicit admin-only writes. Self-assignment of roles is impossible.
CREATE POLICY "Admins manage user roles - insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage user roles - update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage user roles - delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));