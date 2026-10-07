CREATE TABLE IF NOT EXISTS public.platform_staff (
  email text PRIMARY KEY CHECK (email = lower(email)),
  role text NOT NULL DEFAULT 'consultant' CHECK (role IN ('admin', 'consultant')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_staff TO authenticated;
GRANT ALL ON public.platform_staff TO service_role;
ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_staff_admin_read ON public.platform_staff;
CREATE POLICY platform_staff_admin_read ON public.platform_staff
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

INSERT INTO public.platform_staff (email, role) VALUES
  ('rocio@iial.ca', 'admin'),
  ('rafael@example.com', 'admin'),
  ('rafael@iial.ca', 'admin')
ON CONFLICT (email) DO NOTHING;

DELETE FROM public.user_organizations uo
USING public.organizations o
WHERE uo.org_id = o.id
  AND o.slug IN ('iial', 'nahua-canada')
  AND uo.created_at >= '2026-10-07'
  AND coalesce(uo.role, '') <> 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.platform_staff s ON s.email = lower(u.email)
    WHERE u.id = uo.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.org_profiles p WHERE p.org_id = uo.org_id AND p.user_id = uo.user_id
  );

DELETE FROM public.user_roles r
USING auth.users u
WHERE r.user_id = u.id
  AND r.role IN ('admin', 'consultant')
  AND (u.email ILIKE '%rocio%' OR u.email ILIKE '%admin%')
  AND NOT EXISTS (SELECT 1 FROM public.platform_staff s WHERE s.email = lower(u.email))
  AND u.email NOT ILIKE 'demo-admin@%';

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, s.role::public.app_role FROM auth.users u JOIN public.platform_staff s ON s.email = lower(u.email)
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'consultant' FROM auth.users u JOIN public.platform_staff s ON s.email = lower(u.email)
ON CONFLICT DO NOTHING;
INSERT INTO public.user_organizations (user_id, org_id, role)
SELECT u.id, o.id, 'admin'
FROM auth.users u
JOIN public.platform_staff s ON s.email = lower(u.email)
CROSS JOIN public.organizations o
WHERE o.slug IN ('iial', 'nahua-canada')
ON CONFLICT (user_id, org_id) DO NOTHING;

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
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'consultant')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_organizations (user_id, org_id, role)
    SELECT auth.uid(), o.id, 'admin' FROM public.organizations o
    WHERE o.slug IN ('iial', 'nahua-canada')
    ON CONFLICT (user_id, org_id) DO NOTHING;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user() TO authenticated;