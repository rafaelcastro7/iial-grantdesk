CREATE TABLE IF NOT EXISTS public.partner_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  country text,
  type text,
  contact_name text,
  contact_title text,
  email text,
  phone text,
  website text,
  languages text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_directory_org_name_uidx
  ON public.partner_directory (org_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_directory TO authenticated;
GRANT ALL ON public.partner_directory TO service_role;

ALTER TABLE public.partner_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_directory_member_all ON public.partner_directory;
CREATE POLICY partner_directory_member_all ON public.partner_directory
  FOR ALL TO authenticated
  USING (public.is_tenant_member(org_id))
  WITH CHECK (public.is_tenant_member(org_id));

DROP TRIGGER IF EXISTS partner_directory_updated_at ON public.partner_directory;
CREATE TRIGGER partner_directory_updated_at
  BEFORE UPDATE ON public.partner_directory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();