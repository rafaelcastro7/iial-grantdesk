-- Create missing grant review pipeline tables needed by listGrants and grant review worker
-- Ensures listGrants can fetch grant_review_states without throwing relation does not exist error.

CREATE TABLE IF NOT EXISTS public.grant_review_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  criteria_version text NOT NULL DEFAULT 'strict-v1',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','completed','failed','cancelled')),
  pause_reason text,
  total_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  blocked_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  lock_token uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.grant_review_jobs TO authenticated;
GRANT ALL ON public.grant_review_jobs TO service_role;
ALTER TABLE public.grant_review_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can read grant review jobs" ON public.grant_review_jobs;
CREATE POLICY "Organization members can read grant review jobs" ON public.grant_review_jobs
  FOR SELECT TO authenticated USING (public.is_tenant_member(org_id));

DROP POLICY IF EXISTS "Members can create grant review jobs" ON public.grant_review_jobs;
CREATE POLICY "Members can create grant review jobs" ON public.grant_review_jobs
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid() AND public.is_tenant_member(org_id));

DROP POLICY IF EXISTS "Members can update grant review jobs" ON public.grant_review_jobs;
CREATE POLICY "Members can update grant review jobs" ON public.grant_review_jobs
  FOR UPDATE TO authenticated USING (public.is_tenant_member(org_id)) WITH CHECK (public.is_tenant_member(org_id));


CREATE TABLE IF NOT EXISTS public.grant_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.grant_review_jobs(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','blocked','failed','skipped')),
  stage text NOT NULL DEFAULT 'source_check',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lock_token uuid,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, grant_id)
);

GRANT SELECT, INSERT, UPDATE ON public.grant_review_queue TO authenticated;
GRANT ALL ON public.grant_review_queue TO service_role;
ALTER TABLE public.grant_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can read grant review queue" ON public.grant_review_queue;
CREATE POLICY "Organization members can read grant review queue" ON public.grant_review_queue
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.grant_review_jobs j WHERE j.id = job_id AND public.is_tenant_member(j.org_id))
  );

DROP POLICY IF EXISTS "Members can update grant review queue" ON public.grant_review_queue;
CREATE POLICY "Members can update grant review queue" ON public.grant_review_queue
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.grant_review_jobs j WHERE j.id = job_id AND public.is_tenant_member(j.org_id))
  );

CREATE INDEX IF NOT EXISTS grant_review_queue_claim_idx ON public.grant_review_queue(job_id, status, next_attempt_at, priority DESC, created_at);


CREATE TABLE IF NOT EXISTS public.grant_review_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  criteria_version text NOT NULL DEFAULT 'strict-v1',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','applicable','remediable','needs_verification','ineligible','expired','source_unavailable','failed')),
  coverage_pct integer NOT NULL DEFAULT 0 CHECK (coverage_pct BETWEEN 0 AND 100),
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  critical_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  stages jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_count integer NOT NULL DEFAULT 0,
  requirement_count integer NOT NULL DEFAULT 0,
  source_checked_at timestamptz,
  evaluated_at timestamptz,
  next_action text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, grant_id)
);

GRANT SELECT, INSERT, UPDATE ON public.grant_review_states TO authenticated;
GRANT ALL ON public.grant_review_states TO service_role;
ALTER TABLE public.grant_review_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can read grant review states" ON public.grant_review_states;
CREATE POLICY "Organization members can read grant review states" ON public.grant_review_states
  FOR SELECT TO authenticated USING (public.is_tenant_member(org_id));

DROP POLICY IF EXISTS "Members can write grant review states" ON public.grant_review_states;
CREATE POLICY "Members can write grant review states" ON public.grant_review_states
  FOR ALL TO authenticated USING (public.is_tenant_member(org_id)) WITH CHECK (public.is_tenant_member(org_id));

CREATE INDEX IF NOT EXISTS grant_review_states_status_idx ON public.grant_review_states(org_id, status, coverage_pct);


CREATE TABLE IF NOT EXISTS public.grant_review_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  issue_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('remediate','omit','resolved')),
  justification text NOT NULL,
  evidence_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, grant_id, issue_key)
);

GRANT SELECT, INSERT, UPDATE ON public.grant_review_overrides TO authenticated;
GRANT ALL ON public.grant_review_overrides TO service_role;
ALTER TABLE public.grant_review_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can read grant review overrides" ON public.grant_review_overrides;
CREATE POLICY "Organization members can read grant review overrides" ON public.grant_review_overrides
  FOR SELECT TO authenticated USING (public.is_tenant_member(org_id));

DROP POLICY IF EXISTS "Members can write grant review overrides" ON public.grant_review_overrides;
CREATE POLICY "Members can write grant review overrides" ON public.grant_review_overrides
  FOR ALL TO authenticated USING (public.is_tenant_member(org_id)) WITH CHECK (public.is_tenant_member(org_id));
