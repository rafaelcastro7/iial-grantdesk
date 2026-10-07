-- 1) Super admin (rafael@braintrainr.ai), 2) staff list cleanup, 3) QA
-- organization for the synthetic test user, 4) organization profiles corrected
-- to verified facts. Idempotent. No passwords.
--
-- Profile corrections: 20261007070000 seeded IIAL and Nahua Canada with values
-- that are not true and that change eligibility results (fake business
-- numbers, Nahua with 6 years / 14 employees / $1.2M budget / past CanExport
-- and IRAP funding, IIAL with "notice to reader" statements and invented past
-- funders). Facts below come from the team's working notes; unknown values are
-- left empty (NULL) on purpose — unknown is valid, invented is not.

-- 1. Super admin -------------------------------------------------------------
INSERT INTO public.platform_staff (email, role) VALUES ('rafael@braintrainr.ai', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r::public.app_role
FROM auth.users u, unnest(ARRAY['admin', 'consultant', 'member']) r
WHERE lower(u.email) = 'rafael@braintrainr.ai'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_organizations (user_id, org_id, role)
SELECT u.id, o.id, 'admin'
FROM auth.users u CROSS JOIN public.organizations o
WHERE lower(u.email) = 'rafael@braintrainr.ai' AND o.slug IN ('iial', 'nahua-canada')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 2. Staff emails nobody has claimed could be taken by anyone (open sign-up,
--    auto-confirmed email). Keep only claimed ones, plus the super admin, who
--    is granted on first sign-in by ensure_current_user().
DELETE FROM public.platform_staff s
WHERE s.email <> 'rafael@braintrainr.ai'
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = s.email);

-- 3. QA organization for synthetic end-to-end tests -------------------------
INSERT INTO public.organizations (id, name, slug)
VALUES ('9a000000-0000-4000-8000-0000000000a1', 'GrantDesk QA (synthetic)', 'grantdesk-qa')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.user_organizations (user_id, org_id, role)
SELECT u.id, o.id, 'admin'
FROM auth.users u CROSS JOIN public.organizations o
WHERE lower(u.email) IN ('qa.synthetic.consultant@grantdesk-qa.test', 'rafael@braintrainr.ai')
  AND o.slug = 'grantdesk-qa'
ON CONFLICT (user_id, org_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r::public.app_role
FROM auth.users u, unnest(ARRAY['consultant', 'member']) r
WHERE lower(u.email) = 'qa.synthetic.consultant@grantdesk-qa.test'
ON CONFLICT DO NOTHING;

UPDATE public.profiles p SET org_id = o.id
FROM auth.users u, public.organizations o
WHERE p.id = u.id AND lower(u.email) = 'qa.synthetic.consultant@grantdesk-qa.test'
  AND o.slug = 'grantdesk-qa';

-- 4a. IIAL: verified facts ---------------------------------------------------
-- Canada Not-for-profit Corporations Act, corporation no. 1394761-1,
-- incorporated 2022-04-12; Aurora, Ontario; no audited financial statements.
UPDATE public.org_profiles SET
  legal_name = 'Institute of Innovation and Advanced Learning',
  registration_status = 'nonprofit',
  stage = 'nonprofit',
  business_number = NULL,               -- CRA BN not on record (was a fake value)
  years_operating = 4,
  employee_count = NULL,                -- unknown (was invented)
  annual_budget_cad = NULL,             -- unknown (was invented)
  audit_readiness_level = 'unaudited',  -- no audited statements
  in_kind_capacity_cad = NULL,          -- unknown (was invented)
  cost_share_max_pct = NULL,            -- unknown (was invented)
  funding_max_cad = NULL,               -- unknown (was invented)
  past_funders = '{}'::text[],          -- none on record (were invented)
  jurisdictions = ARRAY['CA', 'ON']::text[],
  operating_regions = ARRAY['Canada', 'Latin America']::text[],
  applicant_types = ARRAY['nonprofit', 'academic']::text[],
  consortium_roles = ARRAY['lead_applicant', 'technical_partner']::text[],
  strategic_standards = ARRAY['WCIS (Whole-Chain International Standard)', 'CSIP certification', 'CSCIP certification', 'CARP certification']::text[],
  partner_network = ARRAY[
    'Lambton College', 'Universidad Tecnológica de Tulum', 'Universidad Tecnológica de la Selva',
    'Universidad del Rosario', 'SOCODEVI Peru', 'Agrobosque', 'APP CACAO', 'FUNDALACHUA', 'Nahua Canada'
  ]::text[],
  updated_at = now()
WHERE org_id IN (SELECT id FROM public.organizations WHERE slug = 'iial')
   OR org_id = '7a1c0d2e-0000-4a11-9a11-11a1c0d2e001';

-- 4b. Nahua Canada: newly incorporated for-profit (about one month old, not yet
--     operating, no revenue or staff on record).
UPDATE public.org_profiles SET
  registration_status = 'for_profit',
  stage = 'startup',
  business_number = NULL,               -- not on record (was a fake value)
  website = NULL,                       -- not verified (was invented)
  years_operating = 0,
  employee_count = NULL,
  annual_budget_cad = NULL,
  audit_readiness_level = 'unaudited',
  in_kind_capacity_cad = NULL,
  cost_share_max_pct = NULL,
  funding_min_cad = NULL,
  funding_max_cad = NULL,
  past_funders = '{}'::text[],          -- none (company just created)
  jurisdictions = ARRAY['CA', 'ON']::text[],
  applicant_types = ARRAY['for-profit', 'startup']::text[],
  consortium_roles = ARRAY['commercial_partner']::text[],
  partner_network = ARRAY['IIAL']::text[],
  updated_at = now()
WHERE org_id IN (SELECT id FROM public.organizations WHERE slug = 'nahua-canada');

-- 4c. QA organization copies IIAL's corrected profile (after 4a).
INSERT INTO public.org_profiles (
  org_id, org_name, legal_name, registration_status, mission, website, jurisdictions,
  operating_regions, applicant_types, sectors, activities, capabilities, populations_served,
  focus_areas, stage, languages, years_operating, audit_readiness_level, strategic_standards,
  funding_min_cad
)
SELECT
  q.id, 'GrantDesk QA (synthetic)', p.legal_name, p.registration_status, p.mission, p.website,
  p.jurisdictions, p.operating_regions, p.applicant_types, p.sectors, p.activities,
  p.capabilities, p.populations_served, p.focus_areas, p.stage, p.languages, p.years_operating,
  p.audit_readiness_level, p.strategic_standards, p.funding_min_cad
FROM public.org_profiles p
JOIN public.organizations o ON o.id = p.org_id AND o.slug = 'iial'
CROSS JOIN public.organizations q
WHERE q.slug = 'grantdesk-qa'
LIMIT 1
ON CONFLICT (org_id) DO NOTHING;
