-- Follow-up to 20260930233000 for two grants whose first re-run failed.
-- Matching Investment Fund: previous facts came from the canada.ca menu;
-- reset and refill (amount "up to $150,000" from the official page).
DELETE FROM public.evidence_spans WHERE grant_id = '43bf1042-734e-45a4-9a77-84e30aa33991' AND run_id IN ('87cdbf4e-c7ee-4536-900b-7282d433695e');
-- grant 43bf1042-734e-45a4-9a77-84e30aa33991
UPDATE public.grants SET amount_cad_min = NULL, amount_cad_max = NULL, deadline = NULL, eligibility = '{}'::jsonb, sectors = '{}'::text[], applicant_types = '{}'::text[], populations_served = '{}'::text[], funding_uses = '{}'::text[], funder_type = NULL, deadline_kind = NULL, confirmed_source_urls = NULL, requirements = '[]'::jsonb WHERE id = '43bf1042-734e-45a4-9a77-84e30aa33991';
UPDATE public.grants SET enrich_attempts = 1, enrich_last_attempt_at = '2026-09-30T23:46:29.498Z' WHERE id = '43bf1042-734e-45a4-9a77-84e30aa33991';
INSERT INTO public.evidence_spans (id, grant_id, agent, field, value, source_url, source_hash, snippet, snippet_offset, extraction_method, confidence, model, run_id) SELECT 'ca741044-f809-40ce-8b6a-912138bbb49a', '43bf1042-734e-45a4-9a77-84e30aa33991', 'enricher', 'amount_cad_max', '150000'::jsonb, 'https://www.cdc-ccl.ca/index.php/en/node/748', 'ec03d1435a2f33b6', 'Get a non-repayable contribution of up to $150,000 for product development initiatives that help stimulate demand for Canadian dairy products and ingredients.', NULL, 'llm', 0.6, 'qwen/qwen3.8-27b', '465d5c74-bcef-40f5-8aa1-b0e09ebe3853' WHERE EXISTS (SELECT 1 FROM public.grants WHERE id = '43bf1042-734e-45a4-9a77-84e30aa33991') ON CONFLICT DO NOTHING;
UPDATE public.grants SET amount_cad_max = 150000, status = 'enriched', enriched_at = '2026-09-30T23:46:41.987Z', source_freshness_at = '2026-09-30T23:46:41.987Z', source_confidence = 0.85, enrich_last_error = NULL, enrich_last_attempt_at = '2026-09-30T23:46:41.987Z' WHERE id = '43bf1042-734e-45a4-9a77-84e30aa33991';
-- CIIP: the stored deadline came from "no later than 7 days after the
-- project completion date" (a relative phrase, now rejected). Clear it only.
DELETE FROM public.grant_deadline_observations WHERE grant_id = '02e6bb05-30c4-4fda-a74e-bb6fe61a8115' AND observed_deadline = '2026-10-07';
DELETE FROM public.evidence_spans WHERE grant_id = '02e6bb05-30c4-4fda-a74e-bb6fe61a8115' AND field = 'deadline' AND value = '"2026-10-07"'::jsonb;
UPDATE public.grants SET deadline = NULL, deadline_kind = NULL, deadline_confidence = NULL
 WHERE id = '02e6bb05-30c4-4fda-a74e-bb6fe61a8115' AND deadline = '2026-10-07';
