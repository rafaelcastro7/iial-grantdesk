-- Complete the IIAL tenant profile from its public website (iial.ca,
-- iial.ca/company-overview), consulted 2026-09-30.
--
-- Only empty fields are filled; anything a user already entered is kept.
-- Not published on the site and therefore left unknown: corporation /
-- business number, year founded, annual budget, employee count. The
-- registration status is IIAL's own description ("nonprofit industry
-- education institute"); confirm the incorporation number in /org.
UPDATE public.org_profiles
SET
  legal_name = COALESCE(NULLIF(legal_name, ''), 'Institute of Innovation and Advanced Learning'),
  registration_status = COALESCE(registration_status, 'nonprofit'),
  mission = COALESCE(
    NULLIF(mission, ''),
    'To empower individuals and organizations to innovate responsibly in response to global challenges, equipping them with applied, science-based knowledge that translates into real-world impact across industries.'
  ),
  website = COALESCE(NULLIF(website, ''), 'https://iial.ca'),
  jurisdictions = CASE
    WHEN jurisdictions IS NULL OR cardinality(jurisdictions) = 0 THEN ARRAY['CA', 'ON']::text[]
    ELSE jurisdictions
  END,
  operating_regions = CASE
    WHEN operating_regions IS NULL OR cardinality(operating_regions) = 0
      THEN ARRAY['Canada', 'Latin America']::text[]
    ELSE operating_regions
  END,
  applicant_types = CASE
    WHEN applicant_types IS NULL OR cardinality(applicant_types) = 0 THEN ARRAY['nonprofit']::text[]
    ELSE applicant_types
  END,
  sectors = CASE
    WHEN sectors IS NULL OR cardinality(sectors) = 0 THEN ARRAY[
      'education', 'cleantech', 'agriculture', 'technology',
      'sustainability', 'supply chain integrity', 'ESG'
    ]::text[]
    ELSE sectors
  END,
  activities = CASE
    WHEN activities IS NULL OR cardinality(activities) = 0 THEN ARRAY[
      'Professional certifications (CSIP, CSCIP)',
      'Whole-Chain International Standard (WCIS)',
      'Competency-based professional education and micro-credentials',
      'Executive and corporate training',
      'Applied research with postsecondary and industry partners',
      'Agri-tech and greenhouse optimization pilots',
      'Annual conference and industry engagement events'
    ]::text[]
    ELSE activities
  END,
  capabilities = CASE
    WHEN capabilities IS NULL OR cardinality(capabilities) = 0 THEN ARRAY[
      'Applied research', 'Curriculum and certification design', 'Training delivery',
      'Emissions reduction', 'Supply chain traceability', 'Knowledge mobilization'
    ]::text[]
    ELSE capabilities
  END,
  populations_served = CASE
    WHEN populations_served IS NULL OR cardinality(populations_served) = 0 THEN ARRAY[
      'Professionals', 'SMEs', 'Cooperatives', 'Exporters', 'Postsecondary institutions'
    ]::text[]
    ELSE populations_served
  END,
  focus_areas = COALESCE(
    NULLIF(focus_areas, ''),
    'Sustainability, supply chain integrity and traceability, emissions reduction, ESG and ethical governance, applied innovation in agri-tech.'
  ),
  profile_evidence = CASE
    WHEN profile_evidence IS NULL OR profile_evidence = '[]'::jsonb THEN jsonb_build_array(
      jsonb_build_object('field', 'mission', 'source_url', 'https://iial.ca/company-overview/', 'checked_at', '2026-09-30'),
      jsonb_build_object('field', 'registration_status', 'source_url', 'https://iial.ca/',
        'note', 'Self-described nonprofit industry education institute; incorporation number not published', 'checked_at', '2026-09-30'),
      jsonb_build_object('field', 'address', 'value', '6 - 14845 Yonge St., Suite 156, Aurora, ON L4G 6H8',
        'source_url', 'https://iial.ca/', 'checked_at', '2026-09-30')
    )
    ELSE profile_evidence
  END,
  updated_at = now()
WHERE org_id = '7a1c0d2e-0000-4a11-9a11-11a1c0d2e001';
