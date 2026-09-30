CREATE TABLE public.grant_review_jobs (
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
CREATE POLICY "Organization members can read grant review jobs" ON public.grant_review_jobs FOR SELECT TO authenticated USING (org_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can create grant review jobs" ON public.grant_review_jobs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND requested_by = auth.uid() AND org_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can update grant review jobs" ON public.grant_review_jobs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND org_id IN (SELECT public.user_org_ids(auth.uid()))) WITH CHECK (public.has_role(auth.uid(), 'admin') AND org_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TABLE public.grant_review_queue (
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
CREATE POLICY "Organization members can read grant review queue" ON public.grant_review_queue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.grant_review_jobs j WHERE j.id = job_id AND j.org_id IN (SELECT public.user_org_ids(auth.uid()))));
CREATE POLICY "Admins can create grant review queue" ON public.grant_review_queue FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.grant_review_jobs j WHERE j.id = job_id AND j.org_id IN (SELECT public.user_org_ids(auth.uid()))));
CREATE POLICY "Admins can update grant review queue" ON public.grant_review_queue FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.grant_review_jobs j WHERE j.id = job_id AND j.org_id IN (SELECT public.user_org_ids(auth.uid())))) WITH CHECK (public.has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.grant_review_jobs j WHERE j.id = job_id AND j.org_id IN (SELECT public.user_org_ids(auth.uid()))));
CREATE INDEX grant_review_queue_claim_idx ON public.grant_review_queue(job_id, status, next_attempt_at, priority DESC, created_at);

CREATE TABLE public.grant_review_states (
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
CREATE POLICY "Organization members can read grant review states" ON public.grant_review_states FOR SELECT TO authenticated USING (org_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can create grant review states" ON public.grant_review_states FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND org_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can update grant review states" ON public.grant_review_states FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND org_id IN (SELECT public.user_org_ids(auth.uid()))) WITH CHECK (public.has_role(auth.uid(), 'admin') AND org_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE INDEX grant_review_states_status_idx ON public.grant_review_states(org_id, status, coverage_pct);

CREATE TABLE public.grant_review_overrides (
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
CREATE POLICY "Organization members can read grant review overrides" ON public.grant_review_overrides FOR SELECT TO authenticated USING (org_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can create grant review overrides" ON public.grant_review_overrides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid() AND org_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can update grant review overrides" ON public.grant_review_overrides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND org_id IN (SELECT public.user_org_ids(auth.uid()))) WITH CHECK (public.has_role(auth.uid(), 'admin') AND org_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE OR REPLACE FUNCTION public.claim_grant_review_batch(p_job_id uuid, p_limit integer DEFAULT 5, p_lease_seconds integer DEFAULT 600)
RETURNS SETOF public.grant_review_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT q.id
    FROM public.grant_review_queue q
    WHERE q.job_id = p_job_id
      AND q.status IN ('queued','processing')
      AND q.next_attempt_at <= now()
      AND (q.locked_until IS NULL OR q.locked_until < now())
    ORDER BY q.priority DESC, q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(p_limit, 1), 10)
  )
  UPDATE public.grant_review_queue q
  SET status = 'processing', lock_token = v_token,
      locked_until = now() + make_interval(secs => least(greatest(p_lease_seconds, 60), 1800)),
      attempts = attempts + 1, updated_at = now()
  FROM claimable c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_grant_review_batch(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_grant_review_batch(uuid, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.set_grant_review_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER set_grant_review_jobs_updated_at BEFORE UPDATE ON public.grant_review_jobs FOR EACH ROW EXECUTE FUNCTION public.set_grant_review_updated_at();
CREATE TRIGGER set_grant_review_queue_updated_at BEFORE UPDATE ON public.grant_review_queue FOR EACH ROW EXECUTE FUNCTION public.set_grant_review_updated_at();
CREATE TRIGGER set_grant_review_states_updated_at BEFORE UPDATE ON public.grant_review_states FOR EACH ROW EXECUTE FUNCTION public.set_grant_review_updated_at();
CREATE TRIGGER set_grant_review_overrides_updated_at BEFORE UPDATE ON public.grant_review_overrides FOR EACH ROW EXECUTE FUNCTION public.set_grant_review_updated_at();