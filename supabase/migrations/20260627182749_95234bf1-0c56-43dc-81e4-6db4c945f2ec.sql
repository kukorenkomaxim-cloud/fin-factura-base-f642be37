CREATE TABLE public.document_number_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('proforma','factura')),
  created_mode text NOT NULL CHECK (created_mode IN ('sandbox','production')),
  first_number text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_type, created_mode)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_number_formats TO authenticated;
GRANT ALL ON public.document_number_formats TO service_role;

ALTER TABLE public.document_number_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own number formats"
  ON public.document_number_formats
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_document_number_formats_updated_at
  BEFORE UPDATE ON public.document_number_formats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New numbering model: a document number is unique within one "space"
-- (user + doc_type + created_mode). Drop the old quarter/seq-based constraints.
DROP INDEX IF EXISTS public.documents_user_doctype_seq_nonrect_uidx;
DROP INDEX IF EXISTS public.documents_user_formatted_number_uidx;

CREATE UNIQUE INDEX documents_user_type_mode_number_uidx
  ON public.documents (user_id, doc_type, created_mode, formatted_number);