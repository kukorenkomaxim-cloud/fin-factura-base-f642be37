ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS verifactu_mode TEXT
  CHECK (verifactu_mode IN ('sandbox','production'));