-- Migration: 20261007060000_ensure_client_memberships_for_rocio.sql
-- Ensure Rocio and all platform team members have full access to both IIAL and Nahua Canada.

-- 1. Ensure Nahua Canada organization exists
INSERT INTO public.organizations (id, name, slug)
VALUES (
  '4e616875-612d-4c41-8da0-000000000001',
  'Nahua Canada',
  'nahua-canada'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = now();

-- 2. Ensure Nahua Canada has an org_profile
INSERT INTO public.org_profiles (
  org_id,
  org_name,
  jurisdictions,
  stage,
  applicant_types,
  languages,
  registration_status
)
VALUES (
  '4e616875-612d-4c41-8da0-000000000001',
  'Nahua Canada',
  ARRAY['CA'],
  'startup',
  ARRAY['for-profit'],
  ARRAY['en', 'es'],
  'for_profit'
)
ON CONFLICT (org_id) DO UPDATE
SET org_name = EXCLUDED.org_name,
    updated_at = now();

-- 3. Provision user rocio@iial.ca if not already existing
DO $$
DECLARE
  v_user_id uuid := 'e6bafc11-9ce4-4ece-ad3f-85423d2d0001';
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'rocio@iial.ca') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      'rocio@iial.ca',
      '$2a$10$HTMLY5t9lAPCQMuVyKs9q.Wnzj/WFXVMBscmrfTqEy5eyHRFYVI1O', -- IIAL-Demo-2026!
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Rocio Cruz", "name": "Rocio", "label": "Rocio (IIAL Lead)"}',
      now(),
      now()
    );
  END IF;
END $$;

-- 4. Ensure profile and roles for rocio@iial.ca
DO $$
DECLARE
  v_rocio_id uuid;
BEGIN
  SELECT id INTO v_rocio_id FROM auth.users WHERE email = 'rocio@iial.ca';
  IF v_rocio_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, org_name, preferred_lang, org_id)
    VALUES (v_rocio_id, 'IIAL', 'en', '00000000-0000-0000-0000-000000000001')
    ON CONFLICT (id) DO UPDATE
    SET org_id = COALESCE(public.profiles.org_id, '00000000-0000-0000-0000-000000000001');

    INSERT INTO public.user_roles (user_id, role)
    VALUES 
      (v_rocio_id, 'admin'),
      (v_rocio_id, 'consultant'),
      (v_rocio_id, 'member')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 5. Guarantee explicit memberships in BOTH IIAL and Nahua Canada for all platform users
INSERT INTO public.user_organizations (user_id, org_id, role)
SELECT
  u.id,
  o.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = u.id AND ur.role IN ('admin', 'consultant')
    ) THEN 'admin'
    ELSE 'member'
  END
FROM auth.users u
CROSS JOIN public.organizations o
WHERE o.slug IN ('iial', 'nahua-canada')
ON CONFLICT (user_id, org_id) DO UPDATE
SET role = CASE
  WHEN public.user_organizations.role = 'owner' THEN 'owner'
  WHEN EXCLUDED.role = 'admin' OR public.user_organizations.role = 'admin' THEN 'admin'
  ELSE public.user_organizations.role
END,
updated_at = now();

-- 6. Update ensure_current_user() to automatically link all users to IIAL and Nahua Canada
CREATE OR REPLACE FUNCTION public.ensure_current_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iial_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_nahua_id uuid := '4e616875-612d-4c41-8da0-000000000001'::uuid;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- 1. Profile default
  INSERT INTO public.profiles (id, preferred_lang, org_id)
  VALUES (auth.uid(), 'en', v_iial_id)
  ON CONFLICT (id) DO UPDATE
  SET org_id = COALESCE(public.profiles.org_id, v_iial_id);

  -- 2. Base member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'member')
  ON CONFLICT DO NOTHING;

  -- 3. If user is Rocio or administrative, assign admin & consultant roles
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email ILIKE '%rocio%' OR v_user_email ILIKE '%admin%' OR v_user_email ILIKE '%@iial.ca' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'consultant') ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Explicit membership in both IIAL and Nahua Canada
  INSERT INTO public.user_organizations (user_id, org_id, role)
  VALUES (auth.uid(), v_iial_id, 'admin')
  ON CONFLICT (user_id, org_id) DO NOTHING;

  INSERT INTO public.user_organizations (user_id, org_id, role)
  VALUES (auth.uid(), v_nahua_id, 'admin')
  ON CONFLICT (user_id, org_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user() TO authenticated;
