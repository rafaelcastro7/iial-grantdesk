-- Expand org_profiles with strategic readiness fields based on Rocio & ChatGPT workflow
-- Supports consortium roles, audit readiness levels, in-kind capacity, and strategic partner networks.

ALTER TABLE public.org_profiles
  ADD COLUMN IF NOT EXISTS audit_readiness_level text,
  ADD COLUMN IF NOT EXISTS consortium_roles text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS strategic_standards text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS in_kind_capacity_cad numeric(14,2),
  ADD COLUMN IF NOT EXISTS partner_network text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS past_funders text[] DEFAULT '{}'::text[];

-- Add constraint for audit_readiness_level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_profiles_audit_readiness_level_check'
  ) THEN
    ALTER TABLE public.org_profiles
      ADD CONSTRAINT org_profiles_audit_readiness_level_check
      CHECK (
        audit_readiness_level IS NULL OR
        audit_readiness_level = ANY (ARRAY[
          'unaudited'::text,
          'notice_to_reader'::text,
          'review_engagement'::text,
          'external_audit_1yr'::text,
          'external_audit_3yr'::text
        ])
      );
  END IF;
END $$;

-- Populate IIAL tenant profile
UPDATE public.org_profiles
SET
  legal_name = 'Institute of Innovation and Advanced Learning',
  business_number = COALESCE(NULLIF(business_number, ''), '789456123'),
  registration_status = 'nonprofit',
  stage = 'nonprofit',
  mission = 'To empower individuals and organizations to innovate responsibly in response to global challenges, equipping them with applied, science-based knowledge that translates into real-world impact across industries.',
  website = 'https://iial.ca',
  jurisdictions = ARRAY['CA', 'ON', 'QC']::text[],
  operating_regions = ARRAY['Canada', 'Ontario', 'Quebec', 'Latin America', 'Costa Rica', 'Colombia']::text[],
  applicant_types = ARRAY['nonprofit', 'education', 'research']::text[],
  sectors = ARRAY['education', 'cleantech', 'agriculture', 'technology', 'sustainability', 'supply chain integrity', 'ESG']::text[],
  activities = ARRAY[
    'Professional certifications (CSIP, CSCIP, CARP)',
    'Whole Chain Integrity Standard (WCIS)',
    'Competency-based professional education and micro-credentials',
    'Executive and corporate training',
    'Applied research with postsecondary and industry partners',
    'Agri-tech and greenhouse optimization pilots',
    'Annual conference and industry engagement events'
  ]::text[],
  capabilities = ARRAY[
    'Applied research',
    'Curriculum and certification design',
    'Training delivery',
    'Emissions reduction',
    'Supply chain traceability',
    'Knowledge mobilization',
    'WCIS audit protocols'
  ]::text[],
  populations_served = ARRAY['Professionals', 'SMEs', 'Cooperatives', 'Exporters', 'Postsecondary institutions', 'Smallholder producers']::text[],
  languages = ARRAY['en', 'fr', 'es']::text[],
  years_operating = 4,
  employee_count = 8,
  annual_budget_cad = 450000.00,
  audit_readiness_level = 'notice_to_reader',
  in_kind_capacity_cad = 120000.00,
  cost_share_max_pct = 30.00,
  funding_min_cad = 50000.00,
  funding_max_cad = 1500000.00,
  consortium_roles = ARRAY['technical_partner', 'lead_applicant']::text[],
  strategic_standards = ARRAY['WCIS (Whole Chain Integrity Standard)', 'CSIP Certification', 'CSCIP Certification', 'CARP Certification']::text[],
  partner_network = ARRAY['Lambton College', 'SOCODEVI', 'Nahua Canada', 'Université Laval', 'FIMI']::text[],
  past_funders = ARRAY['Global Affairs Canada (GAC)', 'NRC-IRAP', 'SSHRC', 'CFLI/FCIL']::text[],
  focus_areas = 'Sustainability, supply chain integrity and traceability, emissions reduction, ESG and ethical governance, applied innovation in agri-tech, Latin America cocoa & coffee value chains.',
  updated_at = now()
WHERE org_id = '00000000-0000-0000-0000-000000000001';

-- Populate Nahua Canada tenant profile
UPDATE public.org_profiles
SET
  legal_name = 'Nahua Chocolate & Ingredients Canada Inc.',
  business_number = COALESCE(NULLIF(business_number, ''), '812345678'),
  registration_status = 'for_profit',
  stage = 'sme',
  mission = 'Transforming single-origin specialty cacao supply chains through direct ethical sourcing, regenerative agroforestry, and premium value-added ingredients across the Americas.',
  website = 'https://nahuachocolate.com',
  jurisdictions = ARRAY['CA', 'ON', 'CR']::text[],
  operating_regions = ARRAY['Canada', 'Ontario', 'Costa Rica', 'Latin America']::text[],
  applicant_types = ARRAY['for-profit', 'sme', 'commercial']::text[],
  sectors = ARRAY['agriculture', 'food processing', 'agroforestry', 'export', 'specialty cacao']::text[],
  activities = ARRAY[
    'Direct trade cacao procurement',
    'Regenerative agroforestry farm support',
    'Post-harvest processing & quality grading',
    'Export and distribution to North American chocolatiers'
  ]::text[],
  capabilities = ARRAY[
    'Commercial supply chain management',
    'Farmer network coordination',
    'Single-origin traceability',
    'Sensory analysis & bean grading'
  ]::text[],
  populations_served = ARRAY['Smallholder cacao farmers', 'Artisan chocolate makers', 'Commercial processors']::text[],
  languages = ARRAY['en', 'es']::text[],
  years_operating = 6,
  employee_count = 14,
  annual_budget_cad = 1200000.00,
  audit_readiness_level = 'review_engagement',
  in_kind_capacity_cad = 80000.00,
  cost_share_max_pct = 50.00,
  funding_min_cad = 75000.00,
  funding_max_cad = 2000000.00,
  consortium_roles = ARRAY['commercial_partner', 'lead_applicant']::text[],
  strategic_standards = ARRAY['Direct Trade Cacao Protocol', 'Regenerative Agroforestry Standard', 'Fair Trade Sourced']::text[],
  partner_network = ARRAY['IIAL', 'Costa Rican Cacao Smallholders', 'Ontario Artisan Processors']::text[],
  past_funders = ARRAY['CanExport', 'Agri-Innovate', 'NRC-IRAP']::text[],
  focus_areas = 'Single-origin cacao, regenerative agroforestry, commercial supply chain execution, export logistics, farm-gate farmer empowerment in Central America.',
  updated_at = now()
WHERE org_id = '4e616875-612d-4c41-8da0-000000000001';
