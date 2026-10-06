-- Keep Drizzle deployments aligned with the Lovable/Supabase migration.
ALTER TABLE public.org_profiles
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE public.org_profiles SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.org_profiles
  ALTER COLUMN id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS org_profiles_pkey,
  ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.org_profiles ADD CONSTRAINT org_profiles_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS org_profiles_legacy_user_uq
  ON public.org_profiles(user_id) WHERE org_id IS NULL AND user_id IS NOT NULL;

INSERT INTO public.org_profiles (
  org_id, org_name, stage, jurisdictions, languages, registration_status,
  applicant_types, profile_evidence
)
SELECT '4e616875-612d-4c41-8da0-000000000001', 'Nahua Canada',
       'startup'::public.org_stage, ARRAY['CA']::text[], ARRAY['en', 'es']::text[],
       'for_profit', ARRAY['for-profit']::text[], '[]'::jsonb
WHERE EXISTS (SELECT 1 FROM public.organizations WHERE id = '4e616875-612d-4c41-8da0-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.org_profiles WHERE org_id = '4e616875-612d-4c41-8da0-000000000001');

DROP POLICY IF EXISTS org_profiles_self_all ON public.org_profiles;
DROP POLICY IF EXISTS org_profiles_org_select ON public.org_profiles;
DROP POLICY IF EXISTS org_profiles_org_update ON public.org_profiles;
DROP POLICY IF EXISTS org_profiles_tenant_select ON public.org_profiles;
DROP POLICY IF EXISTS org_profiles_tenant_insert ON public.org_profiles;
DROP POLICY IF EXISTS org_profiles_tenant_update ON public.org_profiles;
DROP POLICY IF EXISTS org_profiles_tenant_delete ON public.org_profiles;
CREATE POLICY org_profiles_tenant_select ON public.org_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)));
CREATE POLICY org_profiles_tenant_insert ON public.org_profiles FOR INSERT TO authenticated
  WITH CHECK ((org_id IS NULL AND user_id = auth.uid()) OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)));
CREATE POLICY org_profiles_tenant_update ON public.org_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)))
  WITH CHECK ((org_id IS NULL AND user_id = auth.uid()) OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)));
CREATE POLICY org_profiles_tenant_delete ON public.org_profiles FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (org_id IS NOT NULL AND public.tenant_membership_role(org_id) IN ('owner', 'admin')));

ALTER TABLE public.grant_evaluations
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.grant_evaluations ge SET org_id = p.org_id
FROM public.profiles p
WHERE p.id = ge.user_id AND ge.org_id IS NULL AND p.org_id IS NOT NULL;
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY org_id, grant_id
    ORDER BY evaluated_at DESC NULLS LAST, created_at DESC, id DESC
  ) AS rn
  FROM public.grant_evaluations WHERE org_id IS NOT NULL
)
DELETE FROM public.grant_evaluations ge USING ranked r WHERE ge.id = r.id AND r.rn > 1;
ALTER TABLE public.grant_evaluations DROP CONSTRAINT IF EXISTS grant_evaluations_user_id_grant_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS grant_evaluations_org_grant_uq ON public.grant_evaluations(org_id, grant_id);
CREATE INDEX IF NOT EXISTS grant_evaluations_org_score_idx ON public.grant_evaluations(org_id, fit_score DESC);

DROP POLICY IF EXISTS grant_evaluations_self_all ON public.grant_evaluations;
DROP POLICY IF EXISTS grant_evaluations_admin_select ON public.grant_evaluations;
DROP POLICY IF EXISTS grant_evaluations_tenant_select ON public.grant_evaluations;
DROP POLICY IF EXISTS grant_evaluations_tenant_insert ON public.grant_evaluations;
DROP POLICY IF EXISTS grant_evaluations_tenant_update ON public.grant_evaluations;
DROP POLICY IF EXISTS grant_evaluations_tenant_delete ON public.grant_evaluations;
CREATE POLICY grant_evaluations_tenant_select ON public.grant_evaluations FOR SELECT TO authenticated
  USING ((org_id IS NULL AND user_id = auth.uid()) OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_evaluations_tenant_insert ON public.grant_evaluations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR public.is_tenant_member(org_id)));
CREATE POLICY grant_evaluations_tenant_update ON public.grant_evaluations FOR UPDATE TO authenticated
  USING ((org_id IS NULL AND user_id = auth.uid()) OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)))
  WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR public.is_tenant_member(org_id)));
CREATE POLICY grant_evaluations_tenant_delete ON public.grant_evaluations FOR DELETE TO authenticated
  USING ((org_id IS NULL AND user_id = auth.uid()) OR (org_id IS NOT NULL AND public.tenant_membership_role(org_id) IN ('owner', 'admin')));
COMMENT ON COLUMN public.grant_evaluations.org_id IS
  'Applicant tenant whose profile and rules produced this verdict; user_id is the last evaluator.';

ALTER TABLE public.fit_rules
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.fit_rules fr
SET id = COALESCE(fr.id, gen_random_uuid()), org_id = COALESCE(fr.org_id, p.org_id)
FROM public.profiles p WHERE p.id = fr.user_id;
UPDATE public.fit_rules SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.fit_rules
  ALTER COLUMN id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS fit_rules_pkey,
  ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.fit_rules ADD CONSTRAINT fit_rules_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS fit_rules_org_uq ON public.fit_rules(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS fit_rules_legacy_user_uq
  ON public.fit_rules(user_id) WHERE org_id IS NULL AND user_id IS NOT NULL;
DROP POLICY IF EXISTS "users manage their own fit rules" ON public.fit_rules;
DROP POLICY IF EXISTS fit_rules_tenant_all ON public.fit_rules;
CREATE POLICY fit_rules_tenant_all ON public.fit_rules FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)))
  WITH CHECK ((org_id IS NULL AND user_id = auth.uid()) OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)));

ALTER TABLE public.shared_fit_reports
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.shared_fit_reports sfr SET org_id = p.org_id
FROM public.profiles p WHERE p.id = sfr.user_id AND sfr.org_id IS NULL;
CREATE INDEX IF NOT EXISTS shared_fit_reports_org_grant_idx ON public.shared_fit_reports(org_id, grant_id);
DROP POLICY IF EXISTS "shared_reports_owner_all" ON public.shared_fit_reports;
DROP POLICY IF EXISTS "sfr_owner" ON public.shared_fit_reports;
DROP POLICY IF EXISTS shared_fit_reports_tenant_all ON public.shared_fit_reports;
CREATE POLICY shared_fit_reports_tenant_all ON public.shared_fit_reports FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_tenant_member(org_id)))
  WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR public.is_tenant_member(org_id)));
