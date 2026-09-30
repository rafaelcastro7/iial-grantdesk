-- ==========================================================================
-- 1. Activar URLs de fuentes en los 134 financiadores
-- ==========================================================================
UPDATE public.funders SET source_url = website WHERE source_url IS NULL AND website IS NOT NULL;

-- ==========================================================================
-- 2. Poblar convocatorias reales (Innovation Canada + Grants.gov)
-- ==========================================================================
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '026a0d2b-2500-422b-8fa8-b9cbd8bf1d8d',
  'Alliance grants',
  'Need R&D help for a business problem? Get support when you partner with a university researcher and make an in-kind contribution to a project that benefits Canada.',
  'https://www.nserc-crsng.gc.ca/Innovate-Innover/alliance-alliance/index_eng.asp',
  'init_416c6c69616e6365206772616e747362',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '9261d389-a8f4-4ce5-a6c6-c39074690d30',
  'Impact Canada Challenge Hub',
  'Get a grant or contribution to cover some or all of the costs related to developing an innovative solution for a specific government challenge.',
  'https://impact.canada.ca/en',
  'init_496d706163742043616e616461204368',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'c34203ba-e549-47ce-b2e7-4fa09bd24caa',
  'Find a Licensed Insolvency Trustee',
  'Connect with a federally licensed professional who can help you restructure your business, file a proposal, or file for bankruptcy.',
  'https://www.ic.gc.ca/app/scr/tds/web/?lang=eng',
  'init_46696e642061204c6963656e73656420',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC IRAP  Financial Assistance',
  'Get a non-repayable contribution to develop, adopt or adapt new or improved technologies at any stage of innovation.',
  'https://nrc.canada.ca/en/support-technology-innovation/financial-support-technology-innovation-through-nrc-irap',
  'init_4e52432049524150202046696e616e63',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC IRAP Advisory Services',
  'Get expert technical and business advice from concept to commercialization in areas like patent searches, strategic intelligence and technology.',
  'https://nrc.canada.ca/en/support-technology-innovation/nrc-irap-advisory-services',
  'init_4e524320495241502041647669736f72',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC IRAP Youth Employment Program',
  'Get financial assistance to help cover the cost of hiring a post-secondary graduate (15 to 30 years old) for 6 to 12 months to work on projects with R&D, engineering, multimedia or market analysis components or the development of a new product or process.',
  'https://nrc.canada.ca/en/support-technology-innovation/nrc-irap-funding-hire-young-graduates',
  'init_4e5243204952415020596f7574682045',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'fa60e6cb-96f4-41f8-b371-2dd8e164f675',
  'Trade Commissioner Service — Canadian International Innovation Program (CIIP) Co-innovation projects',
  'Canadian SMEs can apply for up to $600,000 in funding to help cover research and development project costs while working with a partner in Brazil, India, Israel, Singapore, South Korea, Taiwan, and the UK. When there is a call for proposals with one of th',
  'https://www.tradecommissioner.gc.ca/en/our-solutions/support-programs/canadian-international-innovation-program.html?utm_source=bbf-orae&utm_medium=website&utm_campaign=FTF&utm_term=business_benefits_finder-outil_recherche_aide_aux_entreprises#coinnovatio',
  'init_547261646520436f6d6d697373696f6e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'fa60e6cb-96f4-41f8-b371-2dd8e164f675',
  'Trade Commissioner Service — CanExport Innovation',
  'As an Innovator from a Canadian organization you can apply for up to $75,000 to help cover the costs to pursue and sign research and development (R&D) agreements with international partners.',
  'https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-innovation.html?utm_source=bbf-orae&utm_medium=website&utm_campaign=FTF&utm_term=business_benefits_finder-outil_recherche_aide_aux_entreprises',
  'init_547261646520436f6d6d697373696f6e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'e5b65c01-22d8-4b1d-b2c0-c2b40ac6a821',
  'Mitacs Accelerate',
  'Stretch your $10,000 investment and expand your R&D potential by collaborating with faculty, college students, graduate students, and postdoctoral fellows on your company''s complex research challenges.',
  'https://www.mitacs.ca/our-programs/accelerate-core-business/#business',
  'init_4d697461637320416363656c65726174',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'bc956ded-8c9a-4631-87fc-1975b404493a',
  'Space Technology Development Program',
  'Get a non-repayable contribution for projects related to mission-enabling and generic space technologies.',
  'https://www.asc-csa.gc.ca/eng/funding-programs/funding-opportunities/?filter=STDP',
  'init_537061636520546563686e6f6c6f6779',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '397be36e-31c0-4b8b-a150-06cf54df4031',
  'Northern Ontario Development Program — Youth Internships — Not-for-Profit',
  'Get up to $35,000 annually to cover up to 90% of the eligible costs of hiring a recent graduate for up to 18 months.',
  'https://fednor.canada.ca/en/apply-now/youth-internship-guidelines-applicants',
  'init_4e6f72746865726e204f6e746172696f',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '21715e8e-9c82-486e-8235-325a8a9fe930',
  'Scientific Research and Experimental Development Tax Incentive Program',
  'If your business is engaged in scientific research and experimental development (SR&ED), you can claim a deduction against income or earn an investment tax credit (ITC)',
  'https://www.canada.ca/en/revenue-agency/services/scientific-research-experimental-development-tax-incentive-program.html',
  'init_536369656e7469666963205265736561',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'a9d11b0d-3485-4fee-bc84-e0bacdbc4903',
  'Dairy Innovation Program (DIP)',
  'Benefit from continued access to the milk you need to produce innovative dairy products without affecting your existing provincial milk supply allotment.',
  'https://www.cdc-ccl.ca/en/node/754',
  'init_446169727920496e6e6f766174696f6e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'a9d11b0d-3485-4fee-bc84-e0bacdbc4903',
  'Matching Investment Fund',
  'Get a non-repayable contribution of up to $150,000 for product development initiatives that help stimulate demand for Canadian dairy products and ingredients.',
  'https://www.cdc-ccl.ca/index.php/en/node/748',
  'init_4d61746368696e6720496e766573746d',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '81f7223e-a9d6-428f-aa69-190d25271f07',
  'Aboriginal Entrepreneurship Program — Access to Capital',
  'Get a non-repayable equity contribution of up to $99,999 for business planning, acquisitions, expansion, domestic or export marketing, new product or process development, introducing new technologies and more.',
  'https://www.sac-isc.gc.ca/eng/1375201178602/1610797286236',
  'init_41626f726967696e616c20456e747265',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '943b4ec7-f138-4363-88ea-9b09dc609656',
  'Canada Small Business Financing Program',
  'Help for small businesses to get financing from financial institutions by sharing the risk with lenders.',
  'https://ised-isde.canada.ca/site/canada-small-business-financing-program/en',
  'init_43616e61646120536d616c6c20427573',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '401814e4-4011-4af9-84a3-05972b11cd44',
  'Futurpreneur Canada Newcomer Program',
  'If you are a newcomer entrepreneur between the ages of 18-39 years, you could get a flexible business startup loan of up to $25,000 of which $12,500 is financed by Futurpreneur and $12,500 by BDC, without having an established credit history and receive o',
  'https://futurpreneur.ca/en/offering/newcomers/',
  'init_46757475727072656e6575722043616e',
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
) ON CONFLICT (source_hash) DO NOTHING;
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
  'init_46757475727072656e6575722043616e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '1f9ef38b-0ec2-4c61-bf80-4869f83fd302',
  'CENGN — Centre of Excellence in Next Generation Networks',
  'Access assistance for you Canadian technology SME technology to accelerate your commercialization efforts through secure 5G and advanced networking infrastructure, Living Lab environments, and end-to-end product testing expertise.',
  'https://www.cengn.ca/projects/',
  'init_43454e474e20e280942043656e747265',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '2b02936b-6088-445e-8b79-975cedd50cc8',
  'CBDC Innovation Loan',
  'Get a loan of up to $150,000 to increase your business productivity with the introduction of new technology.',
  'https://www.cbdc.ca/en/programs/cbdc-innovation-loan',
  'init_4342444320496e6e6f766174696f6e20',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'd107e10c-dd4f-4dc5-b7bd-b13aee960818',
  'Southern Ontario Fund for Investment in Innovation',
  'Access interest-bearing loans between $150,000 and $500,000 to support the scale-up of your high-growth, innovative SME.',
  'https://www.cfeasternontario.ca/en/programs/sofii',
  'init_536f75746865726e204f6e746172696f',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'fa60e6cb-96f4-41f8-b371-2dd8e164f675',
  'Trade Commissioner Service — CanExport SMEs',
  'Your SME can get funding of up to $50,000 to help them break into international markets where they have little to no sales.',
  'https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-smes.html?utm_source=bbf-orae&utm_medium=website&utm_campaign=FTF&utm_term=business_benefits_finder-outil_recherche_aide_aux_entreprises',
  'init_547261646520436f6d6d697373696f6e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '535db21d-f183-409c-bc7f-dca8c4b63ab7',
  'BDC Financing — Equipment Purchase Loan',
  'Get a loan to cover up to 125% of the purchase cost of new or used equipment for your business.',
  'https://www.bdc.ca/en/financing/equipment-loan?utm_source=innovation.ised-isde.canada.ca&utm_medium=referral&utm_campaign=business_benefits_finder-outil_recherche_aide_aux_entreprises',
  'init_4244432046696e616e63696e6720e280',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '4e9742e6-ecf9-4323-a4d9-c28a6c641160',
  'Genome Canada',
  'Your not-for-profit organization could get funding for R&D projects in genomics related to agriculture, energy, environment, fisheries, forestry, health and mining.',
  'https://genomecanada.ca/projects-funding-opportunities/',
  'init_47656e6f6d652043616e616461626266',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'e2655ffb-9ab9-4098-b6a1-ccb4edf9c6df',
  'Agricultural Technology Transfer and Licencing',
  'Intellectual property in environmental technology, crops, bioproducts and bioprocesses is available to be commercialized.',
  'https://agriculture.canada.ca/en/scientific-collaboration-and-research-agriculture/technology-transfer-and-licensing-agriculture',
  'init_4167726963756c747572616c20546563',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Aerospace Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for aerospace research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/aerospace-research-centre',
  'init_4e524320e28094204165726f73706163',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Aquatic and Crop Resource Development Research Centre',
  'Fee-for-service facilities designed to help companies with potential to develop and commercialize natural health products. Access technical and advisory services, research facilities and licensing opportunities for aquatic and crop research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/aquatic-crop-resource-development-research-centre',
  'init_4e524320e28094204171756174696320',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Automotive and Surface Transportation',
  'Access technical and advisory services, research facilities and licensing opportunities for automotive research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/automotive-surface-transportation-research-centre',
  'init_4e524320e28094204175746f6d6f7469',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Construction Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for construction research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/construction-research-centre',
  'init_4e524320e2809420436f6e7374727563',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '792da328-6559-4294-bcb6-3805a86a3565',
  'DRDC Defence Research Partnerships',
  'Get the opportunity to collaborate in activities that support strategic objectives and develop new engagement mechanisms that will yield tangible defence research and technology to benefit all partners involved.',
  'https://www.canada.ca/en/defence-research-development/services/partnerships-opportunities.html',
  'init_4452444320446566656e636520526573',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Energy, Mining and Environment Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for energy, mining and environment research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/energy-mining-environment-research-centre',
  'init_4e524320e2809420456e657267792c20',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Human Health Therapeutics Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for human health therapeutics research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/human-health-therapeutics-research-centre',
  'init_4e524320e280942048756d616e204865',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'abe6c52e-d27a-4713-b3f5-f28432e796d4',
  'CIHR Health Research Collaboration',
  'Get access to a variety of funding and health research collaboration opportunities in Canada and globally.',
  'https://cihr-irsc.gc.ca/e/37788.html',
  'init_43494852204865616c74682052657365',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Advanced Electronics and Photonics Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for research on inorganic and organic semiconductor technologies.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/advanced-electronics-photonics-research-centre',
  'init_4e524320e2809420416476616e636564',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Medical Devices Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for medical device research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/medical-devices-research-centre',
  'init_4e524320e28094204d65646963616c20',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Metrology Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for measurement research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/metrology-research-centre',
  'init_4e524320e28094204d6574726f6c6f67',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Quantum and Nanotechnologies Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for nanotechnology research, quantum and materials sciences, photonics and electronics, and device design and engineering.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/nanotechnology-research-centre',
  'init_4e524320e28094205175616e74756d20',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '40b8db5c-4606-4d79-a22c-ee35cb92664b',
  'NRC — Ocean, Coastal and River Engineering Research Centre',
  'Access technical and advisory services, research facilities and licensing opportunities for ocean, coastal and river research.',
  'https://nrc.canada.ca/en/research-development/research-collaboration/research-centres/ocean-coastal-river-engineering-research-centre',
  'init_4e524320e28094204f6365616e2c2043',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'ba3a3bd9-5baf-48f5-ad73-352362bc6d4f',
  'CRC Office of Business Development',
  'Access government wireless technologies, as well as collaborative R&D opportunities.',
  'http://www.crc.gc.ca/eic/site/069.nsf/eng/h_00045.html?Open&src=mm1',
  'init_435243204f6666696365206f66204275',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '0d87e94e-41d6-4b0a-a6f7-d22e299473b9',
  'Inclusive Diversification and Economic Advancement in the North — For-Profit',
  'Access funding for economic infrastructure, sector development and capacity building to help position Northerners in the territories to take advantage of Canada''s innovation economy.',
  'https://www.cannor.gc.ca/eng/1385477070180/1385477215760',
  'init_496e636c757369766520446976657273',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'b3274e3e-56be-462f-97f4-9cb51ad886f4',
  'Making America Healthy Again by Addressing Dementia Disparities',
  'The Office of Minority Health announces the anticipated availability of funds for Fiscal Year (FY) 2025 under the authority of 42 U.S.C. § 300u-6 (Section 1707 of the Public Health Service Act) for demonstration projects to support innovative evidence-based/informed and community-focused approaches that reduce disparities impacting brain health as people age. Demonstration projects are time-limited projects for the purpose of assessing the effectiveness of an approach or intervention toward reaching a desired outcome. We expect award recipients under this opportunity to consider approaches to sustainability beyond the end of the support provided by OMH. Subjective cognitive decline (SCD) is self-reported confusion or memory loss and an early sign of Alzheimer''s disease and dementia. Groups disproportionately affected by dementia and related chronic illnesses may face barriers to health care and social services that increase their risk of poor health outcomes. Projects funded under the initiative will use novel community-based strategies that address social determinants of health (SDOH) and risk factors in the environments where people live, work, learn play and worship. We intend for projects to reduce health disparities and demonstrate progress towards SCD-related Healthy People 2030 objectives. See https://health.gov/healthypeople/objectives-and-data/browse-objectives/dementias for more information. This initiative is in alignment with Make America Healthy Again Commission and the HHS Secretary’s health priorities for preventing and addressing chronic disease.Eligible applicants include any private nonprofit or public entity located in a State. “State” includes, in addition to the several States, only the District of Columbia, Guam, the Commonwealth of Puerto Rico, the Northern Mariana Islands, the Virgin Islands, American Samoa, the Trust Territory of the Pacific Islands, and any agency or instrumentality thereof exclusive of local governments. (42 U.S.C. § 201(f) (PHS Act, Section 2(f)), 45 C.F.R. § 75.2). Eligible entities include private nonprofit or public faith-based organizations, community-based organizations, and American Indian/Alaska Native/Native American (AI/AN/NA) organizations. Recipients of awards must not restrict participation in the project on the basis of race, color, religion, sex, national origin, or other protected characteristic.Applications must be submitted through Grants.gov, and applicants must have an active SAM.gov registration when submitting an application. Interested applicants are strongly encouraged begin the registration process for both systems early. We typically fund awards in 12-month budget periods. We may approve shorter budget periods or periods of performance to accommodate administrative factors or funding constraints. For multi-year projects, recipients must submit a non-competing continuation (NCC) application for each budget period after the first. Continuation funding is contingent upon the availability of funds, satisfactory progress of the project, appropriate stewardship of federal funds, and the best interests of the government. Funding for all approved budget periods after the first is generally the same as the initial award amount subject to any offset with funds unused in the previous budget period.',
  'https://www.grants.gov/search-results-detail/355824',
  'init_4d616b696e6720416d65726963612048',
  'enriched',
  'US',
  'USD',
  450000,
  600000,
  450000,
  600000,
  NULL,
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'b3274e3e-56be-462f-97f4-9cb51ad886f4',
  'Coordinating Center for Language Access Services',
  'The Office of Minority Health announces the anticipated availability of funds for Fiscal Year (FY) 2025 under the authority of 42 U.S.C. § 300u-6 (Section 1707 of the Public Health Service Act) for a demonstration project that supports the development of a National Coordinating Center for Language Access Services . Demonstration projects are time-limited projects for the purpose of assessing the effectiveness of an approach or intervention toward reaching a desired outcome. We expect award recipients under this opportunity to consider approaches to sustainability beyond the end of the support provided by OMH. This initiative aligns with Make America Healthy Again Commission goals and supports Executive Order 14224 by improving new Americans’ access to healthcare.Individuals with limited English proficiency face barriers to health care and social services that increase their risk for poor health outcomes. We intend for the funded project to create a National Coordinating Center to connect health and human service professionals with qualified health language interpreters and translators to improve access to language services for individuals limited English proficiency. The funded project will develop technical components needed to host the Center, connect and engage a collaborative network of community-based organizations, and promote the Center nationally to health and human service organizations and agencies. OMH also expects the project to address gaps in access to language services and improve the quality of care and health outcomes for individuals with limited English proficiency. Eligible applicants include any private nonprofit or public entity located in a State. “State” includes, in addition to the several States, only the District of Columbia, Guam, the Commonwealth of Puerto Rico, the Northern Mariana Islands, the Virgin Islands, American Samoa, the Trust Territory of the Pacific Islands, and any agency or instrumentality thereof exclusive of local governments. (42 U.S.C. § 201(f) (PHS Act, Section 2(f)), 45 C.F.R. § 75.2). Eligible entities include private nonprofit or public faith-based organizations, community-based organizations, and American Indian/Alaska Native/Native American (AI/AN/NA) organizations. Award recipients must not restrict participation in the project on the basis of race, color, religion, sex, national origin, or another protected characteristic.Applications must be submitted through Grants.gov, and applicants must have an active SAM.gov registration when submitting an application. Interested applicants are strongly encouraged begin the registration process for both systems early.',
  'https://www.grants.gov/search-results-detail/355829',
  'init_436f6f7264696e6174696e672043656e',
  'enriched',
  'US',
  'USD',
  600000,
  700000,
  600000,
  700000,
  NULL,
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'b3274e3e-56be-462f-97f4-9cb51ad886f4',
  'Promoting Access with a Language Services Assistance Symbol',
  'The Office of Minority Health announces the anticipated availability of funds for Fiscal Year (FY) 2025 under the authority of 42 U.S.C. § 300u-6 (Section 1707 of the Public Health Service Act) for demonstration projects that support and evaluate the use of a universal symbol to inform people about the availability of language assistance services in health settings. Demonstration projects are time-limited projects for the purpose of assessing the effectiveness of an approach or intervention toward reaching a desired outcome. We expect award recipients under this opportunity to consider approaches to sustainability beyond the end of the support provided by OMH. This initiative aligns with Make America Healthy Again Commission goals, and supports Executive Order 14224 by improving access to healthcare for new Americans with limited English proficiency, as well as individuals with communication disabilities.Individuals with limited English proficiency (LEP) and people with disabilities face barriers to health care and social services that increase their risk for poor health outcomes. Language assistance services are all oral, written, and signed language services needed to assist effective communication for individuals with LEP and people with disabilities. This initiative aligns with Make America Healthy Again Commission goals, and supports Executive Order 14224 by improving access to healthcare for new Americans with limited English proficiency, as well as individuals with communication disabilities.During Fiscal Year 2024, OMH is developing a universal symbol that will indicate the availability of language assistance services. We intend for funded projects to demonstrate the effectiveness of the universal symbol in raising awareness and prompting individuals to request language assistance services in health settings. OMH also expects funded projects to demonstrate progress towards health care communication related Healthy People 2030 objectives. Related information can be found at https://health.gov/healthypeople/objectives-and-data/browse-objectives/health-communication#:~:text=Developmental-,Health%20Care,-Increase%20the%20proportion. Eligible applicants include any private nonprofit or public entity located in a State. “State” includes, in addition to the several States, only the District of Columbia, Guam, the Commonwealth of Puerto Rico, the Northern Mariana Islands, the Virgin Islands, American Samoa, the Trust Territory of the Pacific Islands, and any agency or instrumentality thereof exclusive of local governments. (42 U.S.C. § 201(f) (PHS Act, Section 2(f)), 45 C.F.R. § 75.2). Eligible entities include private nonprofit or public faith-based organizations, community-based organizations, and American Indian/Alaska Native/Native American (AI/AN/NA) organizations. Recipients must not restrict participation in the project on the basis of race, color, religion, sex, national origin, or another protected characteristic.Applications must be submitted through Grants.gov, and applicants must have an active SAM.gov registration when submitting an application. Interested applicants are strongly encouraged to begin the registration process for both systems early. We typically fund awards in 12-month budget periods. We may approve shorter budget periods or periods of performance to accommodate administrative factors or funding constraints. For multi-year projects, recipients must submit a non-competing continuation (NCC) application for each budget period after the first. Continuation funding is contingent upon the availability of funds, satisfactory progress of the project, appropriate stewardship of federal funds, and the best interests of the government. Funding for all approved budget periods after the first is generally the same as the initial award amount subject to any offset with funds unused in the previous budget period.',
  'https://www.grants.gov/search-results-detail/355830',
  'init_50726f6d6f74696e6720416363657373',
  'enriched',
  'US',
  'USD',
  500000,
  600000,
  500000,
  600000,
  NULL,
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  ARRAY['academic', 'charity', 'government', 'indigenous', 'nonprofit']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Feasibility Clinical Trials of Mind and Body Interventions for NCCIH High Priority Research Topics (R34 Clinical Trial Required)',
  'The goal of this notice of funding opportunity (NOFO) is to support feasibility trials of complementary and integrative health approaches with physical and/or psychological therapeutic inputs (often called mind and body interventions) for conditions that have been identified by NCCIH as high-priority research topics. This funding opportunity is intended to support feasibility clinical trials that provide new information that are scientifically necessary for the planning and conduct of a subsequent clinical efficacy or effectiveness study, pragmatic trial, or dissemination and implementation trial within NCCIHs mission. NCCIH expects that applications to this NOFO will describe the planned future clinical trial and in so doing demonstrate that the proposed (R34) research is scientifically necessary to design or plan the subsequent competitive full-scale clinical trial. Under this R34, the data collected should be used to fill gaps in scientific knowledge necessary to develop a competitive full-scale clinical trial, including, but not limited to the following: examining feasibility and acceptability of interventions lacking published data; tailoring or adapting the content or structure of an intervention to a specific population, modality, or setting; refining the intervention to determine the most appropriate frequency or duration; determining feasibility of recruitment, retention, and data collection procedures; refining and assessing the feasibility of protocolized multi-component interventions; or examining acceptability and adherence of control conditions. The subsequent full-scale clinical trial should have the potential to make a significant impact on public health. Prior to submitting to this NOFO, applicants are encouraged to contact the appropriate NCCIH Scientific/Research contact person for the science area of the planned application.',
  'https://www.grants.gov/search-results-detail/357305',
  'init_466561736962696c69747920436c696e',
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-11-17',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Eligible Agencies of the Federal Government; Faith-based or Community-based Organizations; Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Indian/Native American Tribal Governments (Other than Federally Recognized); Non-domestic (non-U.S.) Entities (Foreign Organizations); Regional Organizations; Tribally Controlled Colleges and Universities (TCCUs) ; U.S. Territory or Possession; Non-domestic (non-U.S.) Entities (Foreign Organizations) are not eligible to apply.Non-domestic (non-U.S.) components of U.S. Organizations are not eligible to apply.Foreign components, as defined in the NIH Grants Policy Statement, are allowed.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Investigator Initiated Clinical Trials of Complementary and Integrative Interventions Delivered Remotely or via mHealth (R01 Clinical Trial Required)',
  'This Notice of Funding Opportunity (NOFO) encourages applications for investigator-initiated fully remotely delivered and conducted clinical trials to assess the efficacy or effectiveness of complementary and integrative health interventions in NCCIH- designated areas of high research priority. Applications submitted under this NOFO are expected to propose a remotely delivered and conducted fully powered clinical trial with no in-person contact between research staff and study participants and may utilize mHealth tools or technologies. Applicants must provide justification for the remotely delivered approach and provide preliminary data on the feasibility and safety of the approach, along with evidence that the intervention has promise of clinical benefit. Applicants are encouraged to contact the appropriate NCCIH Scientific/Research contact for the area of science for which they are planning to develop an application prior to submitting to this NOFO.',
  'https://www.grants.gov/search-results-detail/357303',
  'init_496e76657374696761746f7220496e69',
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-11-17',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Eligible Agencies of the Federal Government; Faith-based or Community-based Organizations; Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Indian/Native American Tribal Governments (Other than Federally Recognized); Non-domestic (non-U.S.) Entities (Foreign Organizations); Regional Organizations; Tribally Controlled Colleges and Universities (TCCUs) ; U.S. Territory or Possession; Non-domestic (non-U.S.) Entities (Foreign Organizations) are not eligible to apply.Non-domestic (non-U.S.) components of U.S. Organizations are not eligible to apply.Foreign components, as defined in the NIH Grants Policy Statement, are allowed.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Limited Competition: Small Grant Program for the NCATS Clinical and Translational Science Award (CTSA) Program (R03 Clinical Trial Optional)',
  'The purpose of this NOFO is to enhance the capability of NCATS CTSA Program KL2 scholars and recipients of re-entry supplements supported by the CTSA Program to conduct research as they complete the transition to fully independent academic translational scientists. These R03 grants will support different clinical and translational science research projects, including pilot and feasibility studies; secondary data analysis of existing data; small, self-contained research projects; development of research methodology; and development of new research technology. Research proposed in the R03 application may or may not include patient-oriented research. The R03 is, therefore, intended to support research projects that can be carried out in a short period of time with limited resources and that provide preliminary data to support submission of a subsequent R01, or equivalent, application.',
  'https://www.grants.gov/search-results-detail/357658',
  'init_4c696d6974656420436f6d7065746974',
  'enriched',
  'US',
  'USD',
  NULL,
  50000,
  NULL,
  50000,
  '2026-10-19',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Eligible Agencies of the Federal Government; Faith-based or Community-based Organizations; Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Indian/Native American Tribal Governments (Other than Federally Recognized); Non-domestic (non-U.S.) Entities (Foreign Organizations); Regional Organizations; Tribally Controlled Colleges and Universities (TCCUs) ; U.S. Territory or Possession; Non-domestic (non-U.S.) Entities (Foreign Organizations) are not eligible to apply.Non-domestic (non-U.S.) components of U.S. Organizations are not eligible to apply.Foreign components, as defined in the NIH Grants Policy Statement, are allowed.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Dissemination and Implementation Research in Health (R01 Clinical Trial Optional)',
  'The purpose of this Notice of Funding Opportunity (NOFO) is to support studies that will identify, develop, and/or test strategies for overcoming barriers to the adoption, adaptation, integration, sustainability, scale-up, and spread of evidence-based interventions, practices, programs, tools, treatments, guidelines, and policies (hereafter referred to as evidence-based interventions). Conversely, there is a benefit in understanding circumstances that create a need to stop or reduce (de-implement) the use of practices that are ineffective, unproven, low-value, or harmful. In addition, studies to advance dissemination and implementation research methods and measures are encouraged. Applications that focus on re-implementation of evidence-based health services that may be disrupted amidst disasters (e.g., pandemics) remain relevant. All applications must be within the scope of the mission of one of the Institutes/Centers listed above.',
  'https://www.grants.gov/search-results-detail/356893',
  'init_44697373656d696e6174696f6e20616e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Dissemination and Implementation Research in Health (R21 Clinical Trial Optional)',
  'The purpose of this Funding Opportunity Announcement (FOA) is to support studies that will identify, develop, and/or test strategies for overcoming barriers to the adoption, adaptation, integration, scale-up, and sustainability of evidence-based interventions, practices, programs, tools, treatments, guidelines, and policies. Conversely, there is a benefit in understanding circumstances that create a need to stop or reduce (de-implement) the use of practices that are ineffective, unproven, low-value, or harmful. In addition, studies to advance dissemination and implementation research methods and measures are encouraged.All applications must be within the scope of the mission of one of the Institutes/Centers listed above.',
  'https://www.grants.gov/search-results-detail/356920',
  'init_44697373656d696e6174696f6e20616e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Dissemination and Implementation Research in Health (R03 Clinical Trial Not Allowed)',
  'The purpose of this Funding Opportunity Announcement (FOA) is to support studies that will identify, develop, and/or test strategies for overcoming barriers to the adoption, adaptation, integration, scale-up, and sustainability of evidence-based interventions, practices, programs, tools, treatments, guidelines, and policies. Conversely, there is a benefit in understanding circumstances that create a need to stop or reduce (de-implement) the use of practices that are ineffective, unproven, low-value, or harmful. In addition, studies to advance dissemination and implementation research methods and measures are encouraged. All applications must be within the scope of the mission of one of the Institutes/Centers listed above.',
  'https://www.grants.gov/search-results-detail/356907',
  'init_44697373656d696e6174696f6e20616e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Population Approaches to Reducing Alcohol-related Cancer Risk (R01 Clinical Trial Optional)',
  'This Notice of Funding Opportunity (NOFO) aims to support research on interdisciplinary population approaches to increasing awareness of the relationship between alcohol and cancer risk, understanding and changing social norms related to alcohol consumption, developing and/or evaluating alcohol policy approaches, and the development, testing, and implementation of population-level interventions to reduce alcohol-related cancer risk. Applications that address multiple levels of consumption, such as moderate and heavy drinking, are of particular interest, as well as those focusing on alcohol use disorder (AUD) from the perspective of cancer prevention and control.',
  'https://www.grants.gov/search-results-detail/357021',
  'init_506f70756c6174696f6e20417070726f',
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  '2027-01-07',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Eligible Agencies of the Federal Government; Faith-based or Community-based Organizations; Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Indian/Native American Tribal Governments (Other than Federally Recognized); Non-domestic (non-U.S.) Entities (Foreign Organizations); Regional Organizations; Tribally Controlled Colleges and Universities (TCCUs) ; U.S. Territory or Possession.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Neuromodulation/Neurostimulation Device Development for Mental Health Applications (R21 Clinical Trial Not Allowed)',
  'The purpose of this Notice of Funding Opportunity (NOFO) is to encourage applications seeking to develop the next generation of brain stimulation devices for treating mental health disorders. Applications are sought that will either 1) develop novel brain stimulation devices or 2) significantly enhance, by means of hardware/software improvements, the effectiveness of brain stimulation devices that are currently U.S. Food and Drug Administration (FDA)-approved or cleared. Novel devices should move beyond existing electrical/magnetic stimulation and develop new stimulation techniques capable of increased spatiotemporal precision as well as multi-focal, closed-loop approaches. Applications seeking to develop new capabilities should focus on significant enhancement of the spatial resolution, depth of delivery, and/or precision of the device. Incremental changes to existing devices (e.g., software updates)are not within the scope of this announcement. Applications should be submitted by multi-disciplinary teams with a variety of expertise including systems neuroscience, engineering, clinical, and regulatory affairs.',
  'https://www.grants.gov/search-results-detail/357308',
  'init_4e6575726f6d6f64756c6174696f6e2f',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Cutting-Edge Basic Research Awards (CEBRA) (R21 Clinical Trial Optional)',
  'The National Institute on Drug Abuse (NIDA) Cutting-Edge Basic Research Award (CEBRA) is designed to foster highly innovative or conceptually creative research related to the etiology, pathophysiology, prevention, or treatment of substance use disorders (SUDs). It supports high-risk and potentially high-impact research that is sparse or not included in NIDA''s current portfolio that has the potential to transform SUD research. The proposed research should: 1. develop, and/or adapt, revolutionary techniques or methods for addiction research or that show promising future applicability to SUD research; and /or 2. test an innovative and significant hypothesis for which there are scant precedent or preliminary data and which, if confirmed, would transform current thinking.',
  'https://www.grants.gov/search-results-detail/357941',
  'init_43757474696e672d4564676520426173',
  'enriched',
  'US',
  'USD',
  NULL,
  150000,
  NULL,
  150000,
  '2027-08-11',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Eligible Agencies of the Federal Government; Faith-based or Community-based Organizations; Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Indian/Native American Tribal Governments (Other than Federally Recognized); Non-domestic (non-U.S.) Entities (Foreign Organizations); Regional Organizations; Tribally Controlled Colleges and Universities (TCCUs) ; U.S. Territory or Possession.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'b3274e3e-56be-462f-97f4-9cb51ad886f4',
  'National Training Center for Title X and Teen Pregnancy Prevention (TPP)',
  'We anticipate offering this opportunity in combination with AH-TPS-25-001 to operate a National Training Center that will provide training and technical assistance to all OPA-funded Title X family planning service delivery grantees and all OPA-funded Teen Pregnancy Prevention (TPP) Program recipients. A parallel forecast is posted under AH-TPS-25-001. The funding level and eligibility described in each forecast is specific to that programs requirements. This forecast is for the Title X component. A single notice of funding opportunity will be posted with the details for both. A single application will be required covering PA-FPT-25-001 and AH-TSP-25-001. The application must be submitted under the PA-FPT-25-001 announcement in Grants.gov. The application will consist of 2 distinct parts; one for each program contributing to this opportunity. To receive funding from the Title X program, you must be a public or private non-profit entity. To receive funding from the TPP program, you must be a public or private (non-profit or for-profit) entity. Two or more entities may work together to achieve eligibility for both programs. For example, a private non-profit and a private for-profit could apply as a legally recognized non-profit partnership or consortium that is registered in SAM.gov. Entities wishing to apply jointly without forming a legally recognized relationship should contact OASH_Grants@hhs.gov for instructions on how to prepare an application that will not be disqualified on eligibility grounds as soon as possible. At the time of application, both entities be able to demonstrate an ability to carry out the project together as separate entities, including any conflict resolution, over the entire expected period of performance. Only one applicant will be funded. We intend to award the project using 2 cooperative agreements (one funded under Title X and one funded under the Teen Pregnancy Prevention (TPP) Program). Together the two cooperative agreements together will constitute the National Training Center.Up to $3.5 M is available to address Title X key priority areas (CFDA 93.260) andUp to $1.5 M is available to address TPP key priority areas (CFDA 93.297). For the Title X program - The goal of the funded training center is to ensure that personnel working in Title X have the knowledge, skills, and self-efficacy necessary to effectively run a Title X grant program and deliver high-quality family planning services.The funded training center will provide training and technical assistance for the Title X family planning service grantees focused on:Ensuring access to and implementation of high quality service delivery;Building capacity of the Title X workforce;Strengthening health information and technology; andBuilding financial sustainability.For the TPP Program - The goal of the funded training center is to ensure that personnel working on TPP-funded projects have the knowledge, skills, and self-efficacy necessary to effectively run a TPP funded project to make the greatest impact on communities.The funded training center will provide training and technical assistance for the TPP recipients focused on:Program design, implementation, and evaluation;Building the capacity of TPP project staff to effectively meet the goals of their TPP project;Engagement of key stakeholders in addressing teen pregnancy prevention in their communitiesBest practices in continuous quality improvement and evaluationCommunication, dissemination, and sustainability.We typically fund awards in 12-month budget periods. We may approve shorter budget periods or periods of performance to accommodate administrative factors or funding constraints. For multi-year projects, recipients must submit a non-competing continuation (NCC) application for each budget period after the first. Continuation funding is contingent upon the availability of funds, satisfactory progress of the project, appropriate stewardship of federal funds, and the best interests of the gov',
  'https://www.grants.gov/search-results-detail/355936',
  'init_4e6174696f6e616c20547261696e696e',
  'enriched',
  'US',
  'USD',
  NULL,
  1500000,
  NULL,
  1500000,
  NULL,
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'b3274e3e-56be-462f-97f4-9cb51ad886f4',
  'National Training Center for Title X and Teen Pregnancy Prevention (TPP)',
  'We anticipate offering this opportunity in combination with AH-TPS-25-001 to operate a National Training Center that will provide training and technical assistance to all OPA-funded Title X family planning service delivery grantees and all OPA-funded Teen Pregnancy Prevention (TPP) Program recipients. A parallel forecast is posted under AH-TPS-25-001. The funding level and eligibility described in each forecast is specific to that programs requirements. This forecast is for the Title X component. A single notice of funding opportunity will be posted with the details for both.A single application will be required covering PA-FPT-25-001 and AH-TSP-25-001. The application must be submitted under the PA-FPT-25-001 announcement in Grants.gov. The application will consist of 2 distinct parts; one for each program contributing to this opportunity. To receive funding from the Title X program, you must be a public or private non-profit entity. To receive funding from the TPP program, you must be a public or private (non-profit or for-profit) entity. Two or more entities may work together to achieve eligibility for both programs. For example, a private non-profit and a private for-profit could apply as a legally recognized non-profit partnership or consortium that is registered in SAM.gov. Entities wishing to apply jointly without forming a legally recognized relationship should contact OASH_Grants@hhs.gov for instructions on how to prepare an application that will not be disqualified on eligibility grounds as soon as possible. At the time of application, both entities be able to demonstrate an ability to carry out the project together as separate entities, including any conflict resolution, over the entire expected period of performance. Only one applicant will be funded. We intend to award the project using 2 cooperative agreements (one funded under Title X and one funded under the Teen Pregnancy Prevention (TPP) Program). Together the two cooperative agreements together will constitute the National Training Center. Up to $3.5 M is available to address Title X key priority areas (CFDA 93.260) andUp to $1.5 M is available to address TPP key priority areas (CFDA 93.297). For the Title X program - The goal of the funded training center is to ensure that personnel working in Title X have the knowledge, skills, and self-efficacy necessary to effectively run a Title X grant program and deliver high-quality family planning services.The funded training center will provide training and technical assistance for the Title X family planning service grantees focused on:Ensuring access to and implementation of high quality service delivery;Building capacity of the Title X workforce;Strengthening health information and technology; andBuilding financial sustainability.For the TPP Program - The goal of the funded training center is to ensure that personnel working on TPP-funded projects have the knowledge, skills, and self-efficacy necessary to effectively run a TPP funded project to make the greatest impact on communities.The funded training center will provide training and technical assistance for the TPP recipients focused on:Program design, implementation, and evaluation;Building the capacity of TPP project staff to effectively meet the goals of their TPP project;Engagement of key stakeholders in addressing teen pregnancy prevention in their communitiesBest practices in continuous quality improvement and evaluationCommunication, dissemination, and sustainability.We typically fund awards in 12-month budget periods. We may approve shorter budget periods or periods of performance to accommodate administrative factors or funding constraints. For multi-year projects, recipients must submit a non-competing continuation (NCC) application for each budget period after the first. Continuation funding is contingent upon the availability of funds, satisfactory progress of the project, appropriate stewardship of federal funds, and the best interests of the gov',
  'https://www.grants.gov/search-results-detail/355937',
  'init_4e6174696f6e616c20547261696e696e',
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
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'b3274e3e-56be-462f-97f4-9cb51ad886f4',
  'Pregnancy and Postpartum Hypertension Control Initiative',
  'The Office on Women''s Health (OWH) anticipates the availability of funding for an implementation and scaling project to build upon foundational work in managing hypertension by the HHS Hypertension Innovator Award (OWH), the Hypertension in Pregnancy Change Package (CDC), the National Hypertension Control Initiative (OMH, HRSA), the SMBP Forum and SMBP QI work (CDC), the CDC-supported National Hypertension Control Roundtable, and the HHS Federal Hypertension Control Leadership Council. The lessons generated from these endeavors will be deployed to achieve the current initiative’s primary aim to accelerate nation-wide implementation of SMBP (self-measured blood pressure) during pregnancy and postpartum. SMBP is a best practice defined as the regular measurement of blood pressure by the patient at home or other setting with clinical support. Based on a large body of evidence, SMBP is recommended in both national and international guidelines for the detection and control of HTN in adults and its use postpartum by AHRQ’s Systematic Review and Meta-Analysis on the Management of Postpartum Hypertensive Disorders of Pregnancy.This initiative is intended to serve as the catalyst to drive towards making SMBP a common and routine practice during pregnancy and postpartum. With a special focus on underserved and rural communities, including maternity care deserts, the initiative seeks equitable detection and control of HTN, improved maternal and fetal outcomes, and reductions in admissions and morbidity from HTN-related complications.Applicants will need to demonstrate that they will be able to fully implement their projects within the first six months of the award. Recipients will be expected to evaluate processes and outcomes throughout the project to assess project effectiveness and impact over the period of performance.Over the course of the project, recipients will be expected to document and share project findings and results (e.g., data, best practices, lessons learned) with HHS and others interested in SMBP utilization during pregnancy and postpartum.We expect to fund awards in 12-month budget periods for a total period of performance up to 24 months. Recipients must submit a non-competing continuation (NCC) application for each budget period after the first. Continuation funding is contingent upon the availability of funds, satisfactory progress of the project, appropriate stewardship of federal funds, and the best interests of the government. Funding for all approved budget periods after the first is generally the same as the initial award amount subject to any offset with funds unused in the previous budget period. These projects are time-limited for the purpose of assessing the effectiveness of an approach or intervention toward reaching a desired outcome. We expect award recipients under this opportunity to consider approaches to sustainability beyond the end of the support provided by OWH. Any private (either profit or nonprofit) or public entity located in a State is eligible to apply for an award under this opportunity. “State” includes, in addition to the several States, only the District of Columbia, Guam, the Commonwealth of Puerto Rico, the Northern Mariana Islands, the Virgin Islands, American Samoa, the Trust Territory of the Pacific Islands, and any agency or instrumentality thereof exclusive of local governments. (42 U.S.C. § 201(f) (PHS Act, Section 2(f)), 45 C.F.R. § 75.2). Eligible entities include private (either profit or nonprofit) or public faith-based organizations, community-based organizations, and American Indian/Alaska Native/Native American (AI/AN/NA) organizations.',
  'https://www.grants.gov/search-results-detail/355831',
  'init_507265676e616e637920616e6420506f',
  'enriched',
  'US',
  'USD',
  300000,
  550000,
  300000,
  550000,
  NULL,
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'c9e0bfbf-2898-43f0-919e-11dc6fbe117f',
  'FY 2024 &ndash; 2026 Broad Agency Announcement (BAA), National Marine Fisheries Service',
  'This BAA is for the National Marine Fisheries Service, also known as NOAA Fisheries. The purpose of this notice is to request applications for special projects and programs associated with the NOAA Fisheries strategic plan and mission goals, as well as to provide the general public with information and guidelines on how NOAA will select applications and administer discretionary Federal assistance under this Broad Agency Announcement (BAA). This notice is not a mechanism to fund existing NOAA awards. Each NOAA Line Office that supports financial assistance (National Marine Fisheries Service, National Ocean Service, National Weather Service, Office of Atmospheric Research, Office of Education, and National Environmental Satellite Data Information Service) has a separate BAA found in Grants.gov, so applicants should submit their application to the BAA for the Line Office that best fits their application. A description of NOAA Line Offices is found at https://www.corporateservices.noaa.gov/public/lineoffices.html and https://www.noaa.gov/office-education. Applicants may also contact the Agency Contact below for more information. If you submit the same application to more than Line Office, mention this in your application and notify the relevant contacts so that NOAA may coordinate internally.',
  'https://www.grants.gov/search-results-detail/355706',
  'init_4659203230323420266e646173683b20',
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-30',
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'individual', 'nonprofit', 'small-business']::text[],
  ARRAY['academic', 'charity', 'for-profit', 'government', 'indigenous', 'individual', 'nonprofit', 'small-business']::text[],
  '{}'::jsonb,
  'Eligible applicants may be institutions of higher education, nonprofits, commercial organizations, international or foreign organizations or governments, individuals, state, local, and Indian Tribal governments. Eligibility also depends on the statutory authority that permits NOAA to fund the proposed activity. Funding of Federal organizations is outside the scope of this announcement; if funding authority exists, Federal organizations seeking NOAA funds should contact relevant program officials about the interagency agreement process.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'd692f222-fd9e-4e66-b848-e49fabbf0269',
  'U.S. Embassy Cairo Public Diplomacy Section  Annual Program Statement',
  'PDS Cairo invites proposals for programs that strengthen cultural ties and mutual understanding between the United States and Egypt through cultural, economic, educational, and professional programming.',
  'https://www.grants.gov/search-results-detail/358676',
  'init_552e532e20456d626173737920436169',
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['charity', 'individual', 'nonprofit']::text[],
  ARRAY['charity', 'individual', 'nonprofit']::text[],
  '{}'::jsonb,
  'As stated in the APS'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  'cc0f9349-d273-4b80-905e-3c32979ac427',
  'Broad Agency Announcement for Fundamental AI Research',
  'The purpose of this combined Broad Agency Announcement (BAA) under Federal Acquisition Regulation (FAR) Part 35 and Funding Opportunity Announcement (FOA) under 2 Code of Federal Regulations (CFR) 200.204 (henceforth referred to as “BAA”) is to solicit research proposals for submission to the U.S. Army Artificial Intelligence Integration Center (AI2C) for funding consideration.
This Broad Agency Announcement (BAA), for the Army Artificial Intelligence Integration Center (AI2C), is issued under the provisions of paragraph 6.102(d)(2) and 35.016 of the Federal Acquisition Regulation (FAR), which provides for the acquisition of basic, applied, and advanced research and that part of development not related to the development of a specific system or hardware procurement. This will be done through the competitive selection of proposals, and 10 U.S.C. 4001, 10 U.S.C. 4021, and 10 U.S.C. 4022, which provide the authorities for issuing awards under this announcement for basic, applied, and advanced research. The definitions of basic and applied research may be found at 32 CFR 22.105. Proposals submitted in response to this BAA and selected for award are considered to be the result of full and open competition and in full compliance with the provisions of Public Law 98-369, "The Competition in Contracting Act of 1984" and subsequent amendments.
The Army Artificial Intelligence Integration Center (AI2C) is seeking artificial intelligence research and development whitepapers and proposals in support of new technologies and translational research-based approaches that support the identification, alignment, and exploitation of basic, applied, and advanced research.
AI2C’s foundational research mission spans basic research (budget activity 6.1) and applied research (budget activity 6.2) as defined by 32 CFR 22.105 but may include advanced technology development (budget activity 6.3) and advanced component development and prototypes (budget activity 6.4) when opportunities arise to directly or indirectly help achieve AI2C’s mission.
This publication constitutes a BAA for awards as contemplated in FAR 6.102(d)(2) and 35.016 as well as a merit-based, competitive procedure in accordance with the Department of Defense Grant and Agreement Regulations (DoDGARS) at 32 CFR 22.315(a) and the Office of the Under Secretary of Defense for Acquisition and Sustainment Other Transaction Guide version 2.0 dated July 2023.',
  'https://www.grants.gov/search-results-detail/358687',
  'init_42726f6164204167656e637920416e6e',
  'enriched',
  'US',
  'USD',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  ARRAY['small-business', 'for-profit', 'nonprofit']::text[],
  '{}'::jsonb,
  'Eligible applicants under this BAA include institutions of higher education, nonprofit organizations, state and local governments, foreign organizations, foreign public entities, and for-profit organizations (i.e. large and small businesses).'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '3593b387-d950-4868-858b-93cd27b0909e',
  'University Nuclear Leadership Program&ndash; Scholarship and Fellowship Support',
  'A. STATEMENT OF OBJECTIVES
This Funding Opportunity Announcement (FOA) is to award multiple cooperative agreements to accredited United States (U.S.) two- and four-year colleges and universities (Institutions of Higher Education (IHEs)) to receive and administer scholarship and fellowship funding—provided through the University Nuclear Leadership Program (UNLP) and as administered by the Department of Energy, Office of Nuclear Energy (DOE-NE)—on behalf of selected students attending these U.S. IHEs. The selection of students to receive scholarships and fellowships through the program will occur via a separate DOE-NE process.
A.1 BACKGROUND AND OBJECTIVES
UNLP works to attract qualified nuclear science and engineering students (NS&E) to nuclear energy professions by providing undergraduate level scholarships and graduate level fellowships. The scholarships and fellowships are focused on two-, four-year, and graduate programs in science and engineering disciplines related to nuclear energy such as nuclear engineering, mechanical engineering, electrical engineering, chemistry, health physics, nuclear materials science, radiochemistry, applied nuclear physics, nuclear policy, radiation protection technology, nuclear power technology, nuclear maintenance technology, nuclear engineering technology, computer science, cybersecurity, nuclear safety, nuclear operations, mechanical and electrical maintenance, and radiation protection.
NE’s mission is to advance nuclear energy science and technology to meet U.S. energy, environmental, and economic needs. NE has identified the following goals to address challenges in the nuclear energy sector, help realize the potential of advanced technology, and leverage the unique role of the government in spurring innovation:
• Keep existing U.S. nuclear reactors operating
• Deploy new nuclear reactors
• Secure and sustain our nuclear fuel cycle
• Expand international nuclear energy cooperation
Collectively, all NE-sponsored activities support the Department’s priorities to combat the climate crisis, create clean energy jobs with the free and fair chance to join a union and bargain collectively, and promote equity and environmental justice by delivering innovative clean energy technologies for nuclear energy systems.
UNLP supports NE’s Nuclear Energy University Program (NEUP), which enables outstanding, cutting-edge, and innovative research at U.S. IHEs through the following:
• Integrating research and development (R&D) at U.S. IHEs, national laboratories, and industry to revitalize nuclear education and support NE’s Programs
• Attracting the brightest students to the nuclear professions and supporting the nation’s intellectual capital in science and engineering disciplines
• Improving U.S. IHE’s infrastructure for conducting R&D and educating students
• Facilitating knowledge transfer to the next generation of workers
Educating undergraduate and graduate students in NS&E will:
• Support the ongoing need for personnel who can develop and maintain the nation’s nuclear power technology
• Enhance the R&D capabilities of U.S. IHEs
• Fulfill national demand for highly trained scientists and engineers to work in NS&E areas',
  'https://www.grants.gov/search-results-detail/329436',
  'init_556e6976657273697479204e75636c65',
  'enriched',
  'US',
  'USD',
  NULL,
  3000000,
  NULL,
  3000000,
  '2030-10-14',
  ARRAY['academic', 'government']::text[],
  ARRAY['academic', 'government']::text[],
  '{}'::jsonb,
  'Open to qualified applicants.'
) ON CONFLICT (source_hash) DO NOTHING;
INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '828eb9f7-8c9a-4258-b043-1929c2b219d1',
  'Research Enhancement Award Program (REAP) for Health Professional Schools and Graduate Schools (R15 Clinical Trial Not Allowed)',
  'The purpose of the Research Enhancement Award Program (REAP) for Health Professional Schools and Graduate Schools is to stimulate basic and clinical research in educational institutions that provide baccalaureate or advanced degrees for a significant number of the Nation''s research scientists, but that have not been major recipients of NIH support. REAP grants create opportunities for scientists and institutions otherwise unlikely to participate extensively in NIH research programs to contribute to the Nation''s biomedical and behavioral research effort. REAP grants are intended to support small-scale research projects proposed by faculty members of eligible, domestic institutions, to expose undergraduate and/or graduate students at health professional schools or graduate schools to meritorious research projects, and to strengthen the research environment of the applicant institution.Eligible institutions must award NIH-relevant baccalaureate or advanced degrees in health professions and have received less than $6 million per year of NIH support (total costs) in 4 of the last 7 fiscal years. In this NOFO, a college is a stand-alone entity and not a component of a university system.',
  'https://www.grants.gov/search-results-detail/357568',
  'init_526573656172636820456e68616e6365',
  'enriched',
  'US',
  'USD',
  NULL,
  375000,
  NULL,
  375000,
  '2028-01-07',
  ARRAY['academic', 'government']::text[],
  ARRAY['academic', 'government']::text[],
  '{}'::jsonb,
  'Other Eligible Applicants include the following: Alaska Native and Native Hawaiian Serving Institutions; Asian American Native American Pacific Islander Serving Institutions (AANAPISISs); Hispanic-serving Institutions; Historically Black Colleges and Universities (HBCUs); Tribally Controlled Colleges and Universities (TCCUs) ; Non-domestic (non-U.S.) Entities (Foreign Organizations) are not eligible to apply.Non-domestic (non-U.S.) components of U.S. Organizations are not eligible to apply.Foreign components, as defined in the NIH Grants Policy Statement, are allowed.'
) ON CONFLICT (source_hash) DO NOTHING;