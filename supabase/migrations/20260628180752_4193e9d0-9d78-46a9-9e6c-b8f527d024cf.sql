-- Harden user_roles against self-insert privilege escalation.
-- The prevent_role_escalation() function existed but was never attached as a
-- trigger, so it never executed. Attach it to enforce that no authenticated
-- user can assign themselves (or anyone) a privileged role unless they are
-- already an admin. This backs up the RLS WITH CHECK has_role(...) guard.

DROP TRIGGER IF EXISTS prevent_role_escalation_insert ON public.user_roles;
DROP TRIGGER IF EXISTS prevent_role_escalation_update ON public.user_roles;

CREATE TRIGGER prevent_role_escalation_insert
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

CREATE TRIGGER prevent_role_escalation_update
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();