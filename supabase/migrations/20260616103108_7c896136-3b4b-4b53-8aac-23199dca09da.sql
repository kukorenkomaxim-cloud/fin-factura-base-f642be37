ALTER TABLE public.documents
  ADD COLUMN created_mode text NOT NULL DEFAULT 'sandbox';

ALTER TABLE public.documents
  ADD CONSTRAINT documents_created_mode_check CHECK (created_mode IN ('sandbox', 'production'));