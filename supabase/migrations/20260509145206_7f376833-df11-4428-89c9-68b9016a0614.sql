ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_user_id_doc_type_seq_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS documents_user_doctype_seq_nonrect_uidx
  ON public.documents (user_id, doc_type, seq_number)
  WHERE is_rectifying = false;

CREATE UNIQUE INDEX IF NOT EXISTS documents_user_formatted_number_uidx
  ON public.documents (user_id, formatted_number);