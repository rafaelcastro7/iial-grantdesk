-- IIAL is also an academic institution (university-level programs and
-- applied research), so academic-only calls must not rule it out.
UPDATE public.org_profiles
SET applicant_types = ARRAY(
      SELECT DISTINCT unnest(COALESCE(applicant_types, '{}'::text[]) || ARRAY['nonprofit', 'academic']::text[])
    ),
    updated_at = now()
WHERE org_id = '7a1c0d2e-0000-4a11-9a11-11a1c0d2e001';
