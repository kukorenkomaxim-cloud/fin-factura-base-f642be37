ALTER TABLE public.documents
  ADD COLUMN verifactu_hash text NOT NULL DEFAULT '',
  ADD COLUMN previous_hash text NOT NULL DEFAULT '';