-- Create Nahua Canada as an independent tenant and expose both current IIAL
-- and Nahua workspaces to platform users who already hold a cross-tenant role.
--
-- Access remains explicit in user_organizations. Merely receiving a platform
-- role later does not silently grant access to every tenant; an owner/admin
-- must add the membership through the organization-management workflow.

INSERT INTO public.organizations (id, name, slug)
VALUES (
  '4e616875-612d-4c41-8da0-000000000001',
  'Nahua Canada',
  'nahua-canada'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = now();

-- Existing platform administrators and consultants need an explicit
-- membership to use the tenant picker. Admins manage the tenant; consultants
-- can work in it without receiving tenant-administration rights.
INSERT INTO public.user_organizations (user_id, org_id, role)
SELECT
  ur.user_id,
  o.id,
  CASE
    WHEN bool_or(ur.role = 'admin'::public.app_role) THEN 'admin'
    ELSE 'member'
  END
FROM public.user_roles ur
CROSS JOIN public.organizations o
WHERE ur.role IN ('admin'::public.app_role, 'consultant'::public.app_role)
  AND o.slug IN ('iial', 'nahua-canada')
GROUP BY ur.user_id, o.id
ON CONFLICT (user_id, org_id) DO UPDATE
SET role = CASE
  WHEN public.user_organizations.role = 'owner' THEN 'owner'
  WHEN EXCLUDED.role = 'admin' OR public.user_organizations.role = 'admin' THEN 'admin'
  ELSE 'member'
END,
updated_at = now();

COMMENT ON TABLE public.user_organizations IS
  'Explicit per-tenant memberships. Platform roles do not replace tenant membership.';
