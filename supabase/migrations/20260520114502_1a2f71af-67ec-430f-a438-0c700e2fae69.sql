CREATE OR REPLACE FUNCTION public.release_document_number(_doc_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_last INTEGER;
  v_exists BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _doc_type NOT IN ('proforma','factura') THEN
    RAISE EXCEPTION 'Invalid doc_type';
  END IF;

  -- Lock the counter row to avoid races with concurrent creation/deletion.
  SELECT last_value INTO v_last
  FROM public.document_counters
  WHERE user_id = v_user AND doc_type = _doc_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Walk the counter down while the current top value has no surviving document.
  LOOP
    EXIT WHEN v_last <= 0;

    SELECT EXISTS (
      SELECT 1 FROM public.documents
      WHERE user_id = v_user
        AND doc_type = _doc_type
        AND seq_number = v_last
    ) INTO v_exists;

    EXIT WHEN v_exists;

    v_last := v_last - 1;
  END LOOP;

  UPDATE public.document_counters
  SET last_value = v_last
  WHERE user_id = v_user AND doc_type = _doc_type;

  RETURN v_last;
END;
$$;