-- Trigger-only helper functions must NOT be callable through the API.
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Document numbering RPCs are SECURITY DEFINER and enforce auth.uid() internally.
-- Restrict them to signed-in users only, never anonymous callers.
REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;

REVOKE ALL ON FUNCTION public.release_document_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_document_number(text) TO authenticated;