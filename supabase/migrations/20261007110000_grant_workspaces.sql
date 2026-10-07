-- Application workspace per grant and organization: the decisions and working
-- data a consultant keeps for each opportunity (who applies, lead or partner,
-- consortium, documents checklist, milestones, project idea, decision memo).
-- Mirrors how the IIAL team works the pipeline. Additive.
CREATE TABLE IF NOT EXISTS public.grant_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  -- now | prepare | monitor | discard
  priority text NOT NULL DEFAULT 'monitor'
    CHECK (priority IN ('now', 'prepare', 'monitor', 'discard')),
  -- Organization ids that would apply (e.g. IIAL, Nahua Canada or both).
  applicant_org_ids uuid[] NOT NULL DEFAULT '{}',
  -- lead | co_lead | partner | beneficiary
  route text CHECK (route IN ('lead', 'co_lead', 'partner', 'beneficiary')),
  lead_institution text,
  administrator text,
  call_status text CHECK (call_status IN ('open', 'upcoming', 'rolling', 'closed_next_cycle', 'invite_only')),
  deadline_time text,
  deadline_timezone text,
  instrument text CHECK (instrument IN ('grant', 'contribution', 'repayable_contribution', 'loan', 'cost_share', 'tax_credit', 'other')),
  match_pct numeric CHECK (match_pct IS NULL OR (match_pct >= 0 AND match_pct <= 100)),
  match_in_kind_ok boolean,
  project_title text,
  wcis_angle text,
  blockers text[] NOT NULL DEFAULT '{}',
  partners jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_notes text,
  verified_at date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, grant_id)
);

CREATE INDEX IF NOT EXISTS grant_workspaces_org_priority_idx
  ON public.grant_workspaces (org_id, priority);

ALTER TABLE public.grant_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grant_workspaces_member_all ON public.grant_workspaces;
CREATE POLICY grant_workspaces_member_all ON public.grant_workspaces
  FOR ALL TO authenticated
  USING (public.is_tenant_member(org_id))
  WITH CHECK (public.is_tenant_member(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_workspaces TO authenticated;

DROP TRIGGER IF EXISTS grant_workspaces_updated_at ON public.grant_workspaces;
CREATE TRIGGER grant_workspaces_updated_at
  BEFORE UPDATE ON public.grant_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
