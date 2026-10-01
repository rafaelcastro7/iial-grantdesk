-- 20260929000000 re-created the "Org members can view org ..." policies with an
-- `org_id IS NULL OR ...` branch, re-opening the leak closed by
-- 20260709100000: a proposal or submission with no org was readable by every
-- authenticated user. A NULL org_id means "private to the owner" (covered by
-- the "own proposals" / owner policies), never "public".
--
-- Also lets org members read the sections of their org's proposals: "Open
-- proposal" now opens a teammate's proposal for the same grant, and sections
-- were owner-only, so it showed up empty. Read-only; editing stays with the
-- owner. Additive and idempotent.

DROP POLICY IF EXISTS "Org members can view org proposals" ON public.proposals;
CREATE POLICY "Org members can view org proposals"
  ON public.proposals FOR SELECT
  USING (
    org_id IS NOT NULL
    AND org_id IN (SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members can view org submissions" ON public.submissions;
CREATE POLICY "Org members can view org submissions"
  ON public.submissions FOR SELECT
  USING (
    org_id IS NOT NULL
    AND org_id IN (SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members can view org proposal sections" ON public.proposal_sections;
CREATE POLICY "Org members can view org proposal sections"
  ON public.proposal_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.proposals p
      WHERE p.id = proposal_sections.proposal_id
        AND p.org_id IS NOT NULL
        AND p.org_id IN (SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid())
    )
  );
