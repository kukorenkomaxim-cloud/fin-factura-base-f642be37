CREATE TABLE public.visit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_visit_events_visitor_created ON public.visit_events (visitor_id, created_at DESC);
CREATE INDEX idx_visit_events_created ON public.visit_events (created_at DESC);

GRANT INSERT ON public.visit_events TO anon, authenticated;
GRANT ALL ON public.visit_events TO service_role;

ALTER TABLE public.visit_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous visitor) may record a visit, but nobody can read the raw
-- rows through the Data API. Aggregated stats are served only via the
-- service-role admin server functions.
CREATE POLICY "Anyone can record a visit"
  ON public.visit_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);