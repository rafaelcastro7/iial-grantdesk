-- IIAL is also an academic institution (university-level programs and
-- applied research), so academic-only calls must not rule it out.
UPDATE public.org_profiles
SET applicant_types = ARRAY(
      SELECT DISTINCT unnest(COALESCE(applicant_types, '{}'::text[]) || ARRAY['nonprofit', 'academic']::text[])
    ),
    updated_at = now()
WHERE org_id = '00000000-0000-0000-0000-000000000001';
