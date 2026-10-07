-- Accounts, super admin, QA organization and true organization profiles.
-- Idempotent. No passwords: accounts are created by signing up in the app.
--
-- Account policy (requested by the platform owner):
--   * only @iial.ca accounts may use the platform;
--   * rocio@iial.ca (created by 20261007060000 with its password committed to
--     the repo) is disabled; Rocío uses rocio.cruz@iial.ca;
--   * admin@iial.ca is the super admin (sign up in the app first);
--   * qa.synthetic@iial.ca is the synthetic end-to-end test user, confined to
--     a separate QA organization.
-- Disabled accounts are banned (cannot sign in) and lose every role and
-- membership; rows are not deleted, so nothing that references them breaks.

-- 0. Disable every account outside @iial.ca, and rocio@iial.ca ---------------
WITH disabled AS (
  SELECT id FROM auth.users
  WHERE lower(email) NOT LIKE '%@iial.ca' OR lower(email) = 'rocio@iial.ca'
)
UPDATE auth.users u SET banned_until = 'infinity'
FROM disabled d WHERE u.id = d.id;

DELETE FROM public.user_organizations
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) NOT LIKE '%@iial.ca' OR lower(email) = 'rocio@iial.ca'
);

DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) NOT LIKE '%@iial.ca' OR lower(email) = 'rocio@iial.ca'
);

-- 1. Staff list: only real, current @iial.ca staff --------------------------
DELETE FROM public.platform_staff
WHERE email NOT LIKE '%@iial.ca' OR email = 'rocio@iial.ca';

INSERT INTO public.platform_staff (email, role) VALUES
  ('admin@iial.ca', 'admin'),
  ('rocio.cruz@iial.ca', 'admin'),
  ('clarissa.getigan@iial.ca', 'consultant'),
  ('juan.marcelo.gomez@iial.ca', 'consultant')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

-- Emails nobody has claimed yet could be taken by anyone (open, auto-confirmed
-- sign-up); keep only claimed ones plus admin@iial.ca, which is granted on its
-- first sign-in by ensure_current_user().
DELETE FROM public.platform_staff s
WHERE s.email <> 'admin@iial.ca'
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = s.email);

-- 2. Roles and memberships for staff (IIAL + Nahua Canada) -------------------
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, s.role::public.app_role
FROM auth.users u JOIN public.platform_staff s ON s.email = lower(u.email)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r::public.app_role
FROM auth.users u JOIN public.platform_staff s ON s.email = lower(u.email),
     unnest(ARRAY['consultant', 'member']) r
ON CONFLICT DO NOTHING;

INSERT INTO public.user_organizations (user_id, org_id, role)
SELECT u.id, o.id, 'admin'
FROM auth.users u
JOIN public.platform_staff s ON s.email = lower(u.email)
CROSS JOIN public.organizations o
WHERE o.slug IN ('iial', 'nahua-canada')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 3. QA organization for synthetic end-to-end tests -------------------------
INSERT INTO public.organizations (id, name, slug)
VALUES ('9a000000-0000-4000-8000-0000000000a1', 'GrantDesk QA (synthetic)', 'grantdesk-qa')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.user_organizations (user_id, org_id, role)
SELECT u.id, o.id, 'admin'
FROM auth.users u CROSS JOIN public.organizations o
WHERE lower(u.email) IN ('qa.synthetic@iial.ca', 'admin@iial.ca')
  AND o.slug = 'grantdesk-qa'
ON CONFLICT (user_id, org_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r::public.app_role
FROM auth.users u, unnest(ARRAY['consultant', 'member']) r
WHERE lower(u.email) = 'qa.synthetic@iial.ca'
ON CONFLICT DO NOTHING;

UPDATE public.profiles p SET org_id = o.id
FROM auth.users u, public.organizations o
WHERE p.id = u.id AND lower(u.email) = 'qa.synthetic@iial.ca' AND o.slug = 'grantdesk-qa';

-- 4. ensure_current_user(): admin@iial.ca also joins the QA organization on
--    first sign-in (staff join IIAL + Nahua Canada as before).
CREATE OR REPLACE FUNCTION public.ensure_current_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_staff_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.profiles (id, preferred_lang)
  VALUES (auth.uid(), 'en')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'member')
  ON CONFLICT DO NOTHING;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT role INTO v_staff_role FROM public.platform_staff WHERE email = v_email;
  IF v_staff_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), v_staff_role::public.app_role)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'consultant'::public.app_role)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_organizations (user_id, org_id, role)
    SELECT auth.uid(), o.id, 'admin' FROM public.organizations o
    WHERE o.slug IN ('iial', 'nahua-canada')
       OR (o.slug = 'grantdesk-qa' AND v_email = 'admin@iial.ca')
    ON CONFLICT (user_id, org_id) DO NOTHING;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user() TO authenticated;

-- 5a. IIAL: verified facts ---------------------------------------------------
-- 20261007070000 seeded values that are not true and that change eligibility
-- (fake business numbers, invented staff, budget and past funders). Facts
-- below come from the team's working notes; unknown values stay NULL.
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

-- 5b. Nahua Canada: newly incorporated for-profit (about one month old, not yet
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

-- 5c. QA organization copies IIAL's corrected profile (after 5a).
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

-- 6. Check
SELECT u.email,
       (u.banned_until IS NOT NULL) AS disabled,
       array_agg(DISTINCT o.slug) FILTER (WHERE o.slug IS NOT NULL) AS organizations,
       array_agg(DISTINCT r.role::text) FILTER (WHERE r.role IS NOT NULL) AS roles
FROM auth.users u
LEFT JOIN public.user_organizations uo ON uo.user_id = u.id
LEFT JOIN public.organizations o ON o.id = uo.org_id
LEFT JOIN public.user_roles r ON r.user_id = u.id
GROUP BY u.email, u.banned_until
ORDER BY disabled, u.email;
