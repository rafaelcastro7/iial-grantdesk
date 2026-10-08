-- Grant dossier: the consultant's full analysis of one call for one
-- organization (verdict, hidden traps, route matrix, official documents,
-- money and timeline, ready-to-send messages, sources), in one language.
-- Additive. Readable and writable by members of the organization.
CREATE TABLE IF NOT EXISTS public.grant_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'es')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, grant_id, lang)
);

ALTER TABLE public.grant_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grant_dossiers_member_all ON public.grant_dossiers;
CREATE POLICY grant_dossiers_member_all ON public.grant_dossiers
  FOR ALL TO authenticated
  USING (public.is_tenant_member(org_id))
  WITH CHECK (public.is_tenant_member(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_dossiers TO authenticated;