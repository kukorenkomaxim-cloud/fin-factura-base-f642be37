-- Add multilingual name fields for services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS name_ru text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS name_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS name_es text NOT NULL DEFAULT '';

-- Backfill: copy existing `name` into all three language fields if empty
UPDATE public.services
SET
  name_ru = CASE WHEN name_ru = '' THEN name ELSE name_ru END,
  name_en = CASE WHEN name_en = '' THEN name ELSE name_en END,
  name_es = CASE WHEN name_es = '' THEN name ELSE name_es END;