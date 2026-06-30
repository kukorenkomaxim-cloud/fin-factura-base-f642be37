-- Restrict owner-scoped RLS policies to the authenticated role only.
-- Previously these applied to the public role (which includes anon),
-- allowing anonymous callers to probe the Data API even though auth.uid()
-- returns NULL for them. Scoping to authenticated is defense in depth.

-- bank_accounts
DROP POLICY "own bank delete" ON public.bank_accounts;
DROP POLICY "own bank insert" ON public.bank_accounts;
DROP POLICY "own bank select" ON public.bank_accounts;
DROP POLICY "own bank update" ON public.bank_accounts;
CREATE POLICY "own bank delete" ON public.bank_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bank insert" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bank select" ON public.bank_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bank update" ON public.bank_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- clients
DROP POLICY "own client delete" ON public.clients;
DROP POLICY "own client insert" ON public.clients;
DROP POLICY "own client select" ON public.clients;
DROP POLICY "own client update" ON public.clients;
CREATE POLICY "own client delete" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own client insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own client select" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own client update" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- company_settings
DROP POLICY "own company delete" ON public.company_settings;
DROP POLICY "own company insert" ON public.company_settings;
DROP POLICY "own company select" ON public.company_settings;
DROP POLICY "own company update" ON public.company_settings;
CREATE POLICY "own company delete" ON public.company_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own company insert" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own company select" ON public.company_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own company update" ON public.company_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- document_counters
DROP POLICY "own counter select" ON public.document_counters;
CREATE POLICY "own counter select" ON public.document_counters FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- document_number_formats
DROP POLICY "own number formats" ON public.document_number_formats;
CREATE POLICY "own number formats" ON public.document_number_formats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- documents
DROP POLICY "own doc delete" ON public.documents;
DROP POLICY "own doc insert" ON public.documents;
DROP POLICY "own doc select" ON public.documents;
DROP POLICY "own doc update" ON public.documents;
CREATE POLICY "own doc delete" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own doc insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own doc select" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own doc update" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- email_oauth_accounts
DROP POLICY "own email account delete" ON public.email_oauth_accounts;
DROP POLICY "own email account insert" ON public.email_oauth_accounts;
DROP POLICY "own email account select" ON public.email_oauth_accounts;
DROP POLICY "own email account update" ON public.email_oauth_accounts;
CREATE POLICY "own email account delete" ON public.email_oauth_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own email account insert" ON public.email_oauth_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own email account select" ON public.email_oauth_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own email account update" ON public.email_oauth_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- email_send_log
DROP POLICY "own send log delete" ON public.email_send_log;
DROP POLICY "own send log insert" ON public.email_send_log;
DROP POLICY "own send log select" ON public.email_send_log;
DROP POLICY "own send log update" ON public.email_send_log;
CREATE POLICY "own send log delete" ON public.email_send_log FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own send log insert" ON public.email_send_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own send log select" ON public.email_send_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own send log update" ON public.email_send_log FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- services
DROP POLICY "own service delete" ON public.services;
DROP POLICY "own service insert" ON public.services;
DROP POLICY "own service select" ON public.services;
DROP POLICY "own service update" ON public.services;
CREATE POLICY "own service delete" ON public.services FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own service insert" ON public.services FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own service select" ON public.services FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own service update" ON public.services FOR UPDATE TO authenticated USING (auth.uid() = user_id);
