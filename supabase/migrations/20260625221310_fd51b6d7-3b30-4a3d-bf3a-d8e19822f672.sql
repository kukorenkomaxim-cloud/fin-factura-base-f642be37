-- 1) Replace the always-true INSERT check on visit_events with a validating check.
DROP POLICY IF EXISTS "Anyone can record a visit" ON public.visit_events;

CREATE POLICY "Anyone can record a visit"
ON public.visit_events
FOR INSERT
WITH CHECK (
  visitor_id IS NOT NULL
  AND char_length(visitor_id) BETWEEN 1 AND 100
  AND (path IS NULL OR char_length(path) <= 2048)
);

-- 2) Defense-in-depth: hard-block privilege escalation on user_roles.
-- Direct API callers (auth.uid() set) may never grant a privileged role
-- unless they are already an admin. Service-role operations and the
-- signup trigger run with auth.uid() = NULL and are unaffected.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.role <> 'user'
     AND NOT public.has_role(auth.uid(), 'admin')
  THEN
    RAISE EXCEPTION 'Not authorized to assign role %', NEW.role
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation_trg ON public.user_roles;
CREATE TRIGGER prevent_role_escalation_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- Keep the escalation guard callable only by trusted contexts.
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM anon, authenticated;