-- Members can read the organizations they belong to (any membership, not only
-- the one stored in profiles.org_id). Without this, a member of Nahua Canada
-- could not read the Nahua organization row with their own session, and the
-- tenant picker depended on the service-role key. Additive, read-only.
DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
CREATE POLICY organizations_member_read ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(id));
