-- Sprint 2: Grant Copilot & Product Design Backlog
-- Allows interactive questioning on grants with tenant context and captures design feedback/system improvements.

CREATE TABLE IF NOT EXISTS public.product_design_backlog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES public.grants(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'consorcio_rutas',
  status text NOT NULL DEFAULT 'nuevo',
  impact text NOT NULL DEFAULT 'medio',
  source text NOT NULL DEFAULT 'copilot'
);

CREATE INDEX IF NOT EXISTS product_design_backlog_org_idx
  ON public.product_design_backlog(org_id, created_at DESC);

ALTER TABLE public.product_design_backlog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_design_backlog_select ON public.product_design_backlog;
CREATE POLICY product_design_backlog_select
  ON public.product_design_backlog FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.is_tenant_member(org_id)
  );

DROP POLICY IF EXISTS product_design_backlog_insert ON public.product_design_backlog;
CREATE POLICY product_design_backlog_insert
  ON public.product_design_backlog FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND public.is_tenant_member(org_id)
  );

DROP POLICY IF EXISTS product_design_backlog_update ON public.product_design_backlog;
CREATE POLICY product_design_backlog_update
  ON public.product_design_backlog FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR public.is_tenant_member(org_id)
  )
  WITH CHECK (
    public.is_tenant_member(org_id)
  );

-- Chat messages for Grant Copilot
CREATE TABLE IF NOT EXISTS public.grant_copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  actions jsonb
);

CREATE INDEX IF NOT EXISTS grant_copilot_messages_lookup_idx
  ON public.grant_copilot_messages(grant_id, org_id, created_at ASC);

ALTER TABLE public.grant_copilot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grant_copilot_messages_select ON public.grant_copilot_messages;
CREATE POLICY grant_copilot_messages_select
  ON public.grant_copilot_messages FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.is_tenant_member(org_id)
  );

DROP POLICY IF EXISTS grant_copilot_messages_insert ON public.grant_copilot_messages;
CREATE POLICY grant_copilot_messages_insert
  ON public.grant_copilot_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND public.is_tenant_member(org_id)
  );
