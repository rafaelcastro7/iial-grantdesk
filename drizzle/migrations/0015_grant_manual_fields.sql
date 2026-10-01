-- Human completion of grant facts the automatic search could not find.
--
-- manual_fields:      { "<field>": { "by": uuid, "at": timestamptz, "note": text } }
--                     Fields a person entered; enrichment never overwrites them.
-- field_search_status { "<field>": { "status": "not_found", "checked_at": timestamptz } }
--                     Fields enrichment looked for on the official sources and
--                     did not find, so the UI can say "searched, not found".
-- Additive and nullable.
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS manual_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS field_search_status jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Signed-in users cannot UPDATE grants directly (catalog rows are shared).
-- This function is the only write path for manual facts: a fixed allow-list of
-- fields, typed validation, and an audit entry of who changed what.
CREATE OR REPLACE FUNCTION public.set_grant_manual_field(
  p_grant_id uuid,
  p_field text,
  p_value jsonb,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_entry jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_field NOT IN ('amount_cad_min', 'amount_cad_max', 'deadline', 'eligibility_note', 'sectors', 'applicant_types') THEN
    RAISE EXCEPTION 'field_not_editable: %', p_field;
  END IF;

  -- Checked up front: EXECUTE does not set FOUND.
  IF NOT EXISTS (SELECT 1 FROM public.grants WHERE id = p_grant_id) THEN
    RAISE EXCEPTION 'grant_not_found';
  END IF;

  v_entry := jsonb_build_object('by', v_uid, 'at', now(), 'note', p_note);

  IF p_field IN ('amount_cad_min', 'amount_cad_max') THEN
    IF p_value IS NOT NULL AND p_value <> 'null'::jsonb
       AND (jsonb_typeof(p_value) <> 'number' OR (p_value #>> '{}')::numeric < 0) THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;
    EXECUTE format('UPDATE public.grants SET %I = $1 WHERE id = $2', p_field)
      USING CASE WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN NULL ELSE (p_value #>> '{}')::numeric END,
            p_grant_id;
  ELSIF p_field = 'deadline' THEN
    UPDATE public.grants
       SET deadline = CASE WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN NULL ELSE (p_value #>> '{}')::date END,
           deadline_kind = CASE WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN deadline_kind ELSE 'confirmed' END,
           deadline_confidence = CASE WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN deadline_confidence ELSE 1 END
     WHERE id = p_grant_id;
  ELSIF p_field = 'eligibility_note' THEN
    UPDATE public.grants SET eligibility_note = NULLIF(p_value #>> '{}', '') WHERE id = p_grant_id;
  ELSE
    IF jsonb_typeof(p_value) <> 'array' THEN
      RAISE EXCEPTION 'invalid_list';
    END IF;
    EXECUTE format('UPDATE public.grants SET %I = ARRAY(SELECT jsonb_array_elements_text($1)) WHERE id = $2', p_field)
      USING p_value, p_grant_id;
  END IF;

  UPDATE public.grants
     SET manual_fields = COALESCE(manual_fields, '{}'::jsonb) || jsonb_build_object(p_field, v_entry),
         field_search_status = COALESCE(field_search_status, '{}'::jsonb) - p_field
   WHERE id = p_grant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_grant_manual_field(uuid, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_grant_manual_field(uuid, text, jsonb, text) TO authenticated;
