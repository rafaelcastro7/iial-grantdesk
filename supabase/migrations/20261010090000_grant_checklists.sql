-- Tenant-scoped Claude checklist for one grant and organization.
-- Items carry their own evidence basis inside the JSON payload; the function
-- below changes only `done`, atomically, so two team members do not overwrite
-- each other's progress with a read/modify/write race.
CREATE TABLE IF NOT EXISTS public.grant_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'es')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, grant_id, lang)
);

-- Upgrade the first Lovable/Drizzle version when it already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.grant_checklists'::regclass
      AND conname = 'grant_checklists_org_id_fkey'
  ) THEN
    ALTER TABLE public.grant_checklists
      ADD CONSTRAINT grant_checklists_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.grant_checklists'::regclass
      AND conname = 'grant_checklists_items_array_check'
  ) THEN
    ALTER TABLE public.grant_checklists
      ADD CONSTRAINT grant_checklists_items_array_check
      CHECK (jsonb_typeof(items) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS grant_checklists_org_grant_idx
  ON public.grant_checklists (org_id, grant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_checklists TO authenticated;
GRANT ALL ON public.grant_checklists TO service_role;
ALTER TABLE public.grant_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage their org checklists" ON public.grant_checklists;
CREATE POLICY "Members manage their org checklists"
  ON public.grant_checklists
  FOR ALL TO authenticated
  USING (public.is_tenant_member(org_id))
  WITH CHECK (public.is_tenant_member(org_id));

CREATE OR REPLACE FUNCTION public.set_grant_checklist_item_done(
  p_org_id uuid,
  p_grant_id uuid,
  p_lang text,
  p_item_id text,
  p_done boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  IF p_lang NOT IN ('en', 'es') THEN
    RAISE EXCEPTION 'invalid_language';
  END IF;

  UPDATE public.grant_checklists AS checklist
  SET items = (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN item.value ->> 'id' = p_item_id
                THEN jsonb_set(item.value, '{done}', to_jsonb(p_done), true)
              ELSE item.value
            END
            ORDER BY item.ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(checklist.items) WITH ORDINALITY AS item(value, ordinality)
      ),
      updated_at = now()
  WHERE checklist.org_id = p_org_id
    AND checklist.grant_id = p_grant_id
    AND checklist.lang = p_lang
    AND public.is_tenant_member(checklist.org_id)
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(checklist.items) AS candidate(value)
      WHERE candidate.value ->> 'id' = p_item_id
    )
  RETURNING checklist.items INTO v_items;

  IF v_items IS NULL THEN
    RAISE EXCEPTION 'checklist_or_item_not_found';
  END IF;
  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION public.set_grant_checklist_item_done(uuid, uuid, text, text, boolean)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_grant_checklist_item_done(uuid, uuid, text, text, boolean)
  TO authenticated, service_role;
