CREATE TABLE public.grant_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  lang TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','es')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, grant_id, lang)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_checklists TO authenticated;
GRANT ALL ON public.grant_checklists TO service_role;
ALTER TABLE public.grant_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage their org checklists" ON public.grant_checklists
  FOR ALL TO authenticated
  USING (public.is_tenant_member(org_id))
  WITH CHECK (public.is_tenant_member(org_id));