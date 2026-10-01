-- Restore 6 seed grants silently dropped by the initial catalog load.
-- populate_initial_catalog.sql derived source_hash from the first 16 title
-- characters, so grants sharing a prefix ("Trade Commissioner Service — ...",
-- "Futurpreneur Canada ...", NIH "Dissemination and Implementation ..." R21/R03,
-- the second Title X centre) collided and ON CONFLICT DO NOTHING skipped them.
-- They get a URL-based hash; re-running is a no-op.
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'fa60e6cb-96f4-41f8-b371-2dd8e164f675',
  'Trade Commissioner Service — CanExport Innovation',
  'As an Innovator from a Canadian organization you can apply for up to $75,000 to help cover the costs to pursue and sign research and development (R&D) agreements with international partners.',
  'https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-innovation.html?utm_source=bbf-orae&utm_medium=website&utm_campaign=FTF&utm_term=business_benefits_finder-outil_recherche_aide_aux_entreprises',
  'init_url_' || md5('https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-innovation.html?utm_source=bbf-orae&utm_medium=website&utm_campaign=FTF&utm_term=business_benefits_finder-outil_recherche_aide_aux_entreprises'),
  'enriched',
  'CA',
  'CAD',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
)
ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '401814e4-4011-4af9-84a3-05972b11cd44',
  'Futurpreneur Canada Core Start-Up Program',
  'If you are a young entrepreneur between the ages of 18-39 years,  you could get a flexible, equity-free startup business loan of up to $75,000, including up to $50,000 in financing from BDC*  along with 2 years of 1:1 hand-matched mentorship.
*conditions',
  'https://futurpreneur.ca/en/offering/core-startup/',
  'init_url_' || md5('https://futurpreneur.ca/en/offering/core-startup/'),
  'enriched',
  'CA',
  'CAD',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
)
ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'fa60e6cb-96f4-41f8-b371-2dd8e164f675',
  'Trade Commissioner Service — CanExport SMEs',
  'Your SME can get funding of up to $50,000 to help them break into international markets where they have little to no sales.',
  'https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-smes.html?utm_source=bbf-orae&utm_medium=website&utm_campaign=FTF&utm_term=business_benefits_finder-outil_recherche_aide_aux_entreprises',
  'init_url_' || md5('https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-smes.html?utm_source=bbf-orae&utm_medium=website&utm_campaign=FTF&utm_term=business_benefits_finder-outil_recherche_aide_aux_entreprises'),
  'enriched',
  'CA',
  'CAD',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
)
ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Dissemination and Implementation Research in Health (R21 Clinical Trial Optional)',
  'The purpose of this Funding Opportunity Announcement (FOA) is to support studies that will identify, develop, and/or test strategies for overcoming barriers to the adoption, adaptation, integration, scale-up, and sustainability of evidence-based interventions, practices, programs, tools, treatments, guidelines, and policies. Conversely, there is a benefit in understanding circumstances that create a need to stop or reduce (de-implement) the use of practices that are ineffective, unproven, low-value, or harmful. In addition, studies to advance dissemination and implementation research methods and measures are encouraged.All applications must be within the scope of the mission of one of the Institutes/Centers listed above.',
  'https://www.grants.gov/search-results-detail/356920',
  'init_url_' || md5('https://www.grants.gov/search-results-detail/356920'),
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  '2028-01-07',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Eligible Agencies of the Federal Government; Faith-based or Community-based Organizations; Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Indian/Native American Tribal Governments (Other than Federally Recognized); Non-domestic (non-U.S.) Entities (Foreign Organizations); Regional Organizations; Tribally Controlled Colleges and Universities (TCCUs) ; U.S. Territory or Possession.'
)
ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Dissemination and Implementation Research in Health (R03 Clinical Trial Not Allowed)',
  'The purpose of this Funding Opportunity Announcement (FOA) is to support studies that will identify, develop, and/or test strategies for overcoming barriers to the adoption, adaptation, integration, scale-up, and sustainability of evidence-based interventions, practices, programs, tools, treatments, guidelines, and policies. Conversely, there is a benefit in understanding circumstances that create a need to stop or reduce (de-implement) the use of practices that are ineffective, unproven, low-value, or harmful. In addition, studies to advance dissemination and implementation research methods and measures are encouraged. All applications must be within the scope of the mission of one of the Institutes/Centers listed above.',
  'https://www.grants.gov/search-results-detail/356907',
  'init_url_' || md5('https://www.grants.gov/search-results-detail/356907'),
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  '2028-01-07',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Eligible Agencies of the Federal Government; Faith-based or Community-based Organizations; Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Indian/Native American Tribal Governments (Other than Federally Recognized); Non-domestic (non-U.S.) Entities (Foreign Organizations); Regional Organizations; Tribally Controlled Colleges and Universities (TCCUs) ; U.S. Territory or Possession.'
)
ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'b3274e3e-56be-462f-97f4-9cb51ad886f4',
  'National Training Center for Title X and Teen Pregnancy Prevention (TPP)',
  'We anticipate offering this opportunity in combination with AH-TPS-25-001 to operate a National Training Center that will provide training and technical assistance to all OPA-funded Title X family planning service delivery grantees and all OPA-funded Teen Pregnancy Prevention (TPP) Program recipients. A parallel forecast is posted under AH-TPS-25-001. The funding level and eligibility described in each forecast is specific to that programs requirements. This forecast is for the Title X component. A single notice of funding opportunity will be posted with the details for both.A single application will be required covering PA-FPT-25-001 and AH-TSP-25-001. The application must be submitted under the PA-FPT-25-001 announcement in Grants.gov. The application will consist of 2 distinct parts; one for each program contributing to this opportunity. To receive funding from the Title X program, you must be a public or private non-profit entity. To receive funding from the TPP program, you must be a public or private (non-profit or for-profit) entity. Two or more entities may work together to achieve eligibility for both programs. For example, a private non-profit and a private for-profit could apply as a legally recognized non-profit partnership or consortium that is registered in SAM.gov. Entities wishing to apply jointly without forming a legally recognized relationship should contact OASH_Grants@hhs.gov for instructions on how to prepare an application that will not be disqualified on eligibility grounds as soon as possible. At the time of application, both entities be able to demonstrate an ability to carry out the project together as separate entities, including any conflict resolution, over the entire expected period of performance. Only one applicant will be funded. We intend to award the project using 2 cooperative agreements (one funded under Title X and one funded under the Teen Pregnancy Prevention (TPP) Program). Together the two cooperative agreements together will constitute the National Training Center. Up to $3.5 M is available to address Title X key priority areas (CFDA 93.260) andUp to $1.5 M is available to address TPP key priority areas (CFDA 93.297). For the Title X program - The goal of the funded training center is to ensure that personnel working in Title X have the knowledge, skills, and self-efficacy necessary to effectively run a Title X grant program and deliver high-quality family planning services.The funded training center will provide training and technical assistance for the Title X family planning service grantees focused on:Ensuring access to and implementation of high quality service delivery;Building capacity of the Title X workforce;Strengthening health information and technology; andBuilding financial sustainability.For the TPP Program - The goal of the funded training center is to ensure that personnel working on TPP-funded projects have the knowledge, skills, and self-efficacy necessary to effectively run a TPP funded project to make the greatest impact on communities.The funded training center will provide training and technical assistance for the TPP recipients focused on:Program design, implementation, and evaluation;Building the capacity of TPP project staff to effectively meet the goals of their TPP project;Engagement of key stakeholders in addressing teen pregnancy prevention in their communitiesBest practices in continuous quality improvement and evaluationCommunication, dissemination, and sustainability.We typically fund awards in 12-month budget periods. We may approve shorter budget periods or periods of performance to accommodate administrative factors or funding constraints. For multi-year projects, recipients must submit a non-competing continuation (NCC) application for each budget period after the first. Continuation funding is contingent upon the availability of funds, satisfactory progress of the project, appropriate stewardship of federal funds, and the best interests of the gov',
  'https://www.grants.gov/search-results-detail/355937',
  'init_url_' || md5('https://www.grants.gov/search-results-detail/355937'),
  'enriched',
  'US',
  'USD',
  NULL,
  3500000,
  NULL,
  3500000,
  NULL,
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
)
ON CONFLICT (source_hash) DO NOTHING;
