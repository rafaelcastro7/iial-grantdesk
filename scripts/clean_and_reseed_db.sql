-- ==============================================================================
-- CLEAN AND RESEED DATABASE: GRANTS & PROPOSALS
-- Preserves organizations, users, profiles, funders, and backlog items
-- ==============================================================================

BEGIN;

-- 1. Unlink any product backlog items from grants before deletion so user requests are preserved
UPDATE public.product_design_backlog SET grant_id = NULL WHERE grant_id IS NOT NULL;

-- 2. Clean proposal child tables
DELETE FROM public.proposal_citations;
DELETE FROM public.proposal_citation_reports;
DELETE FROM public.proposal_sections;
DELETE FROM public.proposal_reviews;
DELETE FROM public.logic_models;
DELETE FROM public.compliance_matrices;

-- 3. Clean proposals
DELETE FROM public.proposals;

-- 4. Clean grant child tables
DELETE FROM public.grant_evaluations;
DELETE FROM public.grant_events;
DELETE FROM public.evidence_spans;
DELETE FROM public.grant_search_documents;
DELETE FROM public.grant_search_feedback_events;
DELETE FROM public.grant_search_feedback;
DELETE FROM public.grant_deadline_observations;
DELETE FROM public.grant_copilot_messages;
DELETE FROM public.agent_trace_steps;
DELETE FROM public.agent_runs;
DELETE FROM public.shared_fit_reports;
DELETE FROM public.notifications;
DELETE FROM public.submissions;
DELETE FROM public.outcomes;

-- 5. Clean all existing grants
DELETE FROM public.grants;

-- 6. Insert clean, curated benchmark grants for IIAL / WCIS & Consortium routes
INSERT INTO public.grants (
  id,
  funder_id,
  title,
  summary,
  url,
  source_hash,
  status,
  country,
  currency,
  amount_cad_min,
  amount_cad_max,
  amount_min,
  amount_max,
  deadline,
  deadline_kind,
  applicant_types,
  eligible_applicant_types,
  funding_uses,
  sectors,
  language,
  eligibility_note,
  eligibility,
  requirements
) VALUES 
(
  'a0000001-0000-0000-0000-000000000001',
  '83df88c7-13af-41ee-aa19-9f13a839de64',
  'NSERC Alliance Grant – Applied Agri-Food & Digital Traceability R&D',
  'Supports collaborative R&D projects between Canadian accredited post-secondary researchers and partner organizations (non-profits, industry). Focuses on digital traceability, sustainable supply chains, and food integrity. Cash and in-kind matching contributions from partner organizations are required. Partner organizations can provide in-kind contributions including staff research time, standards integration (WCIS), and validation frameworks.',
  'https://www.nserc-crsng.gc.ca/Innovate-Innover/alliance-alliance/index_eng.asp',
  'hash_nserc_alliance_2026',
  'enriched',
  'CA',
  'CAD',
  100000,
  750000,
  100000,
  750000,
  '2027-06-30',
  'rolling',
  ARRAY['academic', 'nonprofit', 'for-profit']::text[],
  ARRAY['academic', 'nonprofit', 'for-profit']::text[],
  ARRAY['research', 'technology', 'staffing', 'equipment']::text[],
  ARRAY['agriculture', 'technology', 'research', 'supply-chain']::text[],
  'en',
  'Lead applicant must be an accredited Canadian post-secondary institution. Non-profit and private partners participate via consortium agreement.',
  '{"academic": true, "canadian_entity": true, "non_profit": true, "note": "Lead applicant must be an accredited Canadian post-secondary institution. Non-profit and private partners participate via consortium agreement."}'::jsonb,
  '[
    {"category": "governance", "requirement": "Lead applicant must be an accredited Canadian university or college", "value": "Lambton College / Post-secondary", "isCritical": true},
    {"category": "financial", "requirement": "Matching contribution required from partner organizations", "value": "30% cash/in-kind", "isCritical": true},
    {"category": "technical", "requirement": "Project must address a demonstrable Canadian innovation priority", "value": "Agri-food supply chain integrity", "isCritical": false}
  ]'::jsonb
),
(
  'a0000002-0000-0000-0000-000000000002',
  '95fc7f85-2896-4bcf-bbd8-eec5d663d940',
  'Global Affairs Canada – Sustainable Agriculture & LATAM Market Access Fund',
  'Global Affairs Canada funding window for sustainable agricultural development, supply chain transparency, and international trade access in the Americas. Promotes economic inclusion, deforestation-free traceability, and cooperative capacity building. Multi-stakeholder consortia involving Canadian non-profits and regional territorial partners (cooperatives) are strongly encouraged. Financial reporting accepts signed internal financial statements.',
  'https://www.international.gc.ca/development-developpement/partners-partenaires/index.aspx',
  'hash_gac_sustainable_agri_2026',
  'enriched',
  'CA',
  'CAD',
  500000,
  2000000,
  500000,
  2000000,
  NULL,
  'rolling',
  ARRAY['nonprofit', 'indigenous', 'canadian_entity']::text[],
  ARRAY['nonprofit', 'indigenous', 'canadian_entity']::text[],
  ARRAY['capacity-building', 'traceability', 'governance', 'equipment']::text[],
  ARRAY['agriculture', 'international-development', 'trade', 'cooperatives']::text[],
  'en',
  'Open to Canadian registered non-profit entities. Multi-country implementation in the Americas permitted.',
  '{"canadian_entity": true, "non_profit": true, "registered_charity": false, "note": "Open to Canadian registered non-profit entities. Multi-country implementation in the Americas permitted."}'::jsonb,
  '[
    {"category": "geographic", "requirement": "Must operate in eligible Latin American / Caribbean partner countries", "value": "Americas", "isCritical": true},
    {"category": "governance", "requirement": "Multi-party consortium with verified local community representation", "value": "Territorial partner required", "isCritical": true},
    {"category": "financial", "requirement": "Audited financial statements or signed internal financial statements", "value": "Accepted", "isCritical": false}
  ]'::jsonb
),
(
  'a0000003-0000-0000-0000-000000000003',
  'ac35d16e-5863-448c-9fec-8786e600c8b7',
  'Impact Canada Challenge – AI & Clean Agricultural Traceability Hub',
  'Grand challenge prize and milestone-based funding for breakthrough applied technologies that accelerate decarbonization and food chain integrity. Open to Canadian innovators, non-profits, and research coalitions. Winners receive funding upon reaching verified demonstration milestones.',
  'https://impact.canada.ca/en/challenges/food-waste-reduction',
  'hash_impact_canada_traceability_2026',
  'enriched',
  'CA',
  'CAD',
  250000,
  1000000,
  250000,
  1000000,
  '2026-12-15',
  'confirmed',
  ARRAY['small-business', 'nonprofit', 'academic']::text[],
  ARRAY['small-business', 'nonprofit', 'academic']::text[],
  ARRAY['technology', 'pilot', 'prototyping']::text[],
  ARRAY['agriculture', 'technology', 'artificial-intelligence', 'sustainability']::text[],
  'en',
  'Canadian entities with technological innovation capability.',
  '{"canadian_entity": true, "ontario_based": false, "note": "Canadian entities with technological innovation capability."}'::jsonb,
  '[
    {"category": "technical", "requirement": "Working prototype demonstrating verifiable food supply tracking", "value": "TRL 4-7", "isCritical": true},
    {"category": "milestones", "requirement": "Demonstrated field pilot within 12 months", "value": "Pilot required", "isCritical": true}
  ]'::jsonb
),
(
  'a0000004-0000-0000-0000-000000000004',
  'a53aeeb7-a68e-4166-a864-c215d5388a01',
  'NRC IRAP – International Agri-Food Commercial Innovation Partnership',
  'Accelerates market readiness, technology demonstration, and international supply chain integration for high-potential Canadian innovations. Provides non-repayable contributions covering eligible internal technical staff and commercial pilot development.',
  'https://nrc.canada.ca/en/support-technology-innovation/nrc-irap',
  'hash_irap_commercial_innovation_2026',
  'enriched',
  'CA',
  'CAD',
  50000,
  350000,
  50000,
  350000,
  NULL,
  'rolling',
  ARRAY['for-profit', 'small-business']::text[],
  ARRAY['for-profit', 'small-business']::text[],
  ARRAY['salaries', 'subcontracting', 'commercialization']::text[],
  ARRAY['technology', 'commercialization', 'agriculture']::text[],
  'en',
  'Canadian incorporated commercial entities. Non-profit partners can serve as technical subcontractors.',
  '{"for_profit": true, "canadian_entity": true, "note": "Canadian incorporated commercial entities. Non-profit partners can serve as technical subcontractors."}'::jsonb,
  '[
    {"category": "corporate", "requirement": "Incorporated Canadian business with under 500 employees", "value": "Canadian SME", "isCritical": true},
    {"category": "commercial", "requirement": "Clear commercialization plan and market traction", "value": "Route D partner", "isCritical": false}
  ]'::jsonb
),
(
  'a0000005-0000-0000-0000-000000000005',
  '25809cb6-f601-4067-8ec9-67c329df8093',
  'Discovery Test Call: Americas Climate Smart Agriculture Demonstration',
  'Newly announced initiative for multi-stakeholder agricultural demonstration projects. Raw opportunity awaiting complete guideline extraction.',
  'https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/environmental_sustainability-durabilite_environnementale.aspx',
  'hash_discovery_test_call_2026',
  'discovered',
  'CA',
  'CAD',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'rolling',
  ARRAY['nonprofit', 'academic', 'indigenous']::text[],
  ARRAY['nonprofit', 'academic', 'indigenous']::text[],
  ARRAY['capacity-building', 'research']::text[],
  ARRAY['agriculture', 'climate', 'sustainability']::text[],
  'en',
  'Preliminary announcement for demonstration projects.',
  '{"note": "Preliminary announcement."}'::jsonb,
  '[]'::jsonb
);

-- 7. Add evaluations for IIAL tenant (org_id: 00000000-0000-0000-0000-000000000001)
INSERT INTO public.grant_evaluations (
  grant_id,
  org_id,
  user_id,
  prompt_version,
  fit_score,
  eligibility_pass,
  rationale_en,
  model,
  rule_snapshot,
  axis_breakdown
) VALUES
(
  'a0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  'v2',
  0.88,
  true,
  'High strategic fit via Route B (Academic R&D Consortium with Lambton College). IIAL provides the WCIS standard, applied traceability research, and in-kind matching. Grant covers significant technical staff OPEX.',
  'rules-engine-deterministic',
  '{"verdict": "eligible", "checks": []}'::jsonb,
  '[
    {"name": "thematic_alignment", "score": 0.95, "weight": 0.4},
    {"name": "consortium_viability", "score": 0.90, "weight": 0.3},
    {"name": "financial_feasibility", "score": 0.80, "weight": 0.3}
  ]'::jsonb
),
(
  'a0000002-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  'v2',
  0.92,
  true,
  'Prime strategic opportunity via Route C (LATAM Territorial Consortium with regional cooperatives). Directly funds sustainable agriculture and traceability pilot, positioning IIAL as technical and standards architect.',
  'rules-engine-deterministic',
  '{"verdict": "eligible", "checks": []}'::jsonb,
  '[
    {"name": "thematic_alignment", "score": 0.98, "weight": 0.4},
    {"name": "consortium_viability", "score": 0.92, "weight": 0.3},
    {"name": "financial_feasibility", "score": 0.85, "weight": 0.3}
  ]'::jsonb
),
(
  'a0000003-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  'v2',
  0.78,
  true,
  'Strong fit for piloting WCIS technology and AI supply chain integrity under Route A or B.',
  'rules-engine-deterministic',
  '{"verdict": "eligible", "checks": []}'::jsonb,
  '[
    {"name": "thematic_alignment", "score": 0.85, "weight": 0.4},
    {"name": "consortium_viability", "score": 0.75, "weight": 0.3},
    {"name": "financial_feasibility", "score": 0.70, "weight": 0.3}
  ]'::jsonb
),
(
  'a0000004-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  'v2',
  0.55,
  false,
  'Direct application is blocked because applicant must be a for-profit commercial entity. However, viable via Route D (Commercial Innovation) with Nahua Canada or an SME partner.',
  'rules-engine-deterministic',
  '{"verdict": "needs_input", "checks": [{"rule": "for_profit_required", "passed": false, "reason": "Requires commercial SME lead"}]}'::jsonb,
  '[
    {"name": "thematic_alignment", "score": 0.80, "weight": 0.4},
    {"name": "consortium_viability", "score": 0.50, "weight": 0.3},
    {"name": "financial_feasibility", "score": 0.40, "weight": 0.3}
  ]'::jsonb
);

-- 7b. Index search documents for fast hybrid lexical search
INSERT INTO public.grant_search_documents (
  grant_id,
  content_en,
  content_fr,
  content_hash
) VALUES
(
  'a0000001-0000-0000-0000-000000000001',
  'NSERC Alliance Grants – Agri-Food Supply Chain Traceability and Applied Technology. Natural Sciences and Engineering Research Council of Canada (NSERC). Supports collaborative research and development between university or college researchers and partner organizations across agriculture, food processing, digital traceability, artificial intelligence, and supply chain integrity. Open to accredited Canadian colleges and universities in partnership with Canadian non-profits and industry.',
  '',
  'hash_search_nserc_traceability_2026'
),
(
  'a0000002-0000-0000-0000-000000000002',
  'Global Affairs Canada – Sustainable Agriculture & Economic Growth in the Americas. Global Affairs Canada (GAC). Catalyzes climate-smart agriculture, fair-trade market access, and verified sustainable value chains in Latin America and the Caribbean. Multi-country initiatives empowering smallholder cooperatives through traceability and international standards compliance. Americas regional cooperation, cacao, coffee.',
  '',
  'hash_search_gac_sustainable_agri_2026'
),
(
  'a0000003-0000-0000-0000-000000000003',
  'Impact Canada Challenge – AI & Clean Agricultural Traceability Hub. Impact Canada. Grand challenge prize and milestone-based funding for breakthrough applied technologies that accelerate decarbonization and food chain integrity. Open to Canadian innovators, non-profits, and research coalitions. Winners receive funding upon reaching verified demonstration milestones. Prototyping, pilot, artificial intelligence, supply chain integrity.',
  '',
  'hash_search_impact_canada_traceability_2026'
),
(
  'a0000004-0000-0000-0000-000000000004',
  'NRC IRAP – International Agri-Food Commercial Innovation Partnership. National Research Council Canada - Industrial Research Assistance Program (NRC IRAP). Accelerates market readiness, technology demonstration, and international supply chain integration for high-potential Canadian innovations. Provides non-repayable contributions covering eligible internal technical staff and commercial pilot development. Commercialization, SME, subcontracting, salaries.',
  '',
  'hash_search_irap_commercial_innovation_2026'
),
(
  'a0000005-0000-0000-0000-000000000005',
  'Discovery Test Call: Americas Climate Smart Agriculture Demonstration. Innovation, Science and Economic Development Canada. Newly announced initiative for multi-stakeholder agricultural demonstration projects. Raw opportunity awaiting complete guideline extraction.',
  '',
  'hash_search_discovery_test_call_2026'
);

-- 8. Add sample proposals to demonstrate proposal workflow
INSERT INTO public.proposals (
  id,
  grant_id,
  user_id,
  org_id,
  title,
  status,
  version,
  language,
  metadata
) VALUES (
  'b0000001-0000-0000-0000-000000000001',
  'a0000002-0000-0000-0000-000000000002',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  '00000000-0000-0000-0000-000000000001',
  'Global Affairs Canada – Multi-Country Cacao & Coffee Traceability Initiative',
  'draft',
  1,
  'en',
  '{"consortium_route": "Route C", "lead_partner": "Territorial Cooperative", "wcis_role": "Standards & Verification"}'::jsonb
);

INSERT INTO public.proposal_sections (
  id,
  proposal_id,
  user_id,
  kind,
  ord,
  heading_en,
  content_en
) VALUES 
(
  'c0000001-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  'summary',
  1,
  'Executive Summary & Project Objectives',
  'This initiative establishes a cross-border sustainable agriculture and digital traceability corridor connecting smallholder producer organizations in Latin America with Canadian and international value chains.'
),
(
  'c0000002-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  'team',
  2,
  'Consortium Governance & Role Matrix',
  'Lead Territorial Applicant manages regional governance and cooperative intake. The Inter-American Institute for Agricultural Leadership (IIAL) leads technical design, whole-chain verification protocols, and WCIS standard deployment.'
);

-- 9. Add initial Copilot messages & Action artifacts
INSERT INTO public.grant_copilot_messages (
  id,
  grant_id,
  org_id,
  user_id,
  role,
  content,
  actions
) VALUES (
  'd0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'e6bafc11-9ce4-4ece-ad3f-85423d2d531c',
  'assistant',
  'Hello! I analyzed this NSERC Alliance opportunity against the IIAL organization profile. Because NSERC requires an accredited post-secondary institution as the primary applicant, the recommended pathway is Route B (Academic / R&D Consortium with Lambton College). IIAL contributes the Whole Chain Integrity Standard (WCIS), applied traceability research, and industry co-supervision.',
  '[
    {
      "type": "outreach_draft",
      "target_partner": "Lambton College Research & Innovation",
      "subject": "Proposed Collaboration: NSERC Alliance on Agri-Food Traceability & WCIS",
      "body": "Dear Lambton College Research Team,\n\nWe are preparing a multi-stakeholder initiative under the NSERC Alliance framework focused on digital agri-food traceability and supply chain integrity. Given Lambton College applied research expertise and accreditation, we would welcome the opportunity to structure a collaborative proposal with Lambton as lead academic institution and IIAL as technical standards partner."
    }
  ]'::jsonb
);

COMMIT;
