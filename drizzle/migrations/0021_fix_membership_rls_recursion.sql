DROP POLICY IF EXISTS "Users can view their own org memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can view org members of their orgs" ON public.user_organizations;
DROP POLICY IF EXISTS "Org owners and admins can add members" ON public.user_organizations;
DROP POLICY IF EXISTS "Org owners and admins can update members" ON public.user_organizations;
DROP POLICY IF EXISTS "Org owners can remove members" ON public.user_organizations;
DROP POLICY IF EXISTS user_organizations_member_select ON public.user_organizations;
DROP POLICY IF EXISTS user_organizations_admin_insert ON public.user_organizations;
DROP POLICY IF EXISTS user_organizations_admin_update ON public.user_organizations;
DROP POLICY IF EXISTS user_organizations_owner_delete ON public.user_organizations;
DROP FUNCTION IF EXISTS public.is_tenant_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.tenant_membership_role(uuid, uuid);

CREATE OR REPLACE FUNCTION public.is_tenant_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.org_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_membership_role(_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT uo.role
  FROM public.user_organizations uo
  WHERE uo.user_id = auth.uid()
    AND uo.org_id = _org_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_membership_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_membership_role(uuid) TO authenticated, service_role;

CREATE POLICY user_organizations_member_select
  ON public.user_organizations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_member(org_id)
  );

CREATE POLICY user_organizations_admin_insert
  ON public.user_organizations FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_membership_role(org_id) IN ('owner', 'admin')
  );

CREATE POLICY user_organizations_admin_update
  ON public.user_organizations FOR UPDATE TO authenticated
  USING (
    public.tenant_membership_role(org_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.tenant_membership_role(org_id) IN ('owner', 'admin')
  );

CREATE POLICY user_organizations_owner_delete
  ON public.user_organizations FOR DELETE TO authenticated
  USING (
    user_id <> auth.uid()
    AND public.tenant_membership_role(org_id) = 'owner'
  );