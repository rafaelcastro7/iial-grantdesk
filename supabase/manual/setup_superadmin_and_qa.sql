-- One-time setup (paste in Cloud -> Database -> SQL editor). No passwords here.
-- Before running: sign up in the app with your own email (rafael@braintrainr.ai)
-- so the account exists. Re-runnable.

-- 1. Super admin: platform staff, admin + consultant roles, member of IIAL and
--    Nahua Canada (and the QA organization below).
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

-- 2. Sign-up is open and emails are auto-confirmed, so a staff email that has
--    no account yet could be claimed by anyone. Keep only claimed emails.
DELETE FROM public.platform_staff s
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = s.email);

-- 3. QA organization for the synthetic test user, with IIAL's profile copied,
--    so end-to-end tests never write into the real IIAL or Nahua data.
INSERT INTO public.organizations (id, name, slug)
VALUES ('9a000000-0000-4000-8000-0000000000a1', 'GrantDesk QA (synthetic)', 'grantdesk-qa')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.org_profiles (
  org_id, org_name, legal_name, registration_status, mission, website, jurisdictions,
  operating_regions, applicant_types, sectors, activities, capabilities, populations_served,
  focus_areas, stage, languages
)
SELECT
  q.id, 'GrantDesk QA (synthetic)', p.legal_name, p.registration_status, p.mission, p.website,
  p.jurisdictions, p.operating_regions, p.applicant_types, p.sectors, p.activities,
  p.capabilities, p.populations_served, p.focus_areas, p.stage, p.languages
FROM public.org_profiles p
JOIN public.organizations o ON o.id = p.org_id AND o.slug = 'iial'
CROSS JOIN public.organizations q
WHERE q.slug = 'grantdesk-qa'
LIMIT 1
ON CONFLICT (org_id) DO NOTHING;

-- Synthetic consultant and super admin are members of the QA organization.
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

-- Check
SELECT u.email, o.slug, uo.role
FROM public.user_organizations uo
JOIN auth.users u ON u.id = uo.user_id
JOIN public.organizations o ON o.id = uo.org_id
WHERE lower(u.email) IN ('rafael@braintrainr.ai', 'qa.synthetic.consultant@grantdesk-qa.test')
ORDER BY u.email, o.slug;
