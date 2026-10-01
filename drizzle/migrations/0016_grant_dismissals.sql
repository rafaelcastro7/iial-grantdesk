-- A consultant can mark a grant as not relevant ("it's a loan, not a
-- grant", "outside our field", ...). Per user, so one consultant's choice
-- does not hide the grant from others. Additive.
CREATE TABLE IF NOT EXISTS public.grant_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('loan_not_grant', 'outside_field', 'too_small', 'not_eligible', 'other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, grant_id)
);

ALTER TABLE public.grant_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grant_dismissals_own ON public.grant_dismissals;
CREATE POLICY grant_dismissals_own ON public.grant_dismissals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_dismissals TO authenticated;
