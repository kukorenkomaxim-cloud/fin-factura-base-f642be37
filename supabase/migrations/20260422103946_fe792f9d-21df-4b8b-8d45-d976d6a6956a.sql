
ALTER TABLE public.company_settings ADD COLUMN country text NOT NULL DEFAULT '';
ALTER TABLE public.clients ADD COLUMN country text NOT NULL DEFAULT '';

-- Also add country columns to the documents table to snapshot at document creation time
ALTER TABLE public.documents ADD COLUMN issuer_country text NOT NULL DEFAULT '';
ALTER TABLE public.documents ADD COLUMN client_country text NOT NULL DEFAULT '';
