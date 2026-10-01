-- Final fit reviews written by Claude (claude-opus-5-5) for all 60 catalog
-- grants, against the IIAL profile. Applies to every member of the IIAL
-- organization. Safe to re-run. Paste into Cloud -> Database -> SQL editor.
WITH review(grant_id, eligible, fit, rationale) AS (
VALUES
  ('d1751e03-050f-4a21-834c-70bc54cf9ccc'::uuid, false, 0.10, 'IIAL is not eligible for the Aboriginal Entrepreneurship Program: it funds Indigenous-owned businesses and Indigenous community businesses, and IIAL is neither Indigenous-owned nor a business. Not worth pursuing.'),
  ('4fff4582-2e8e-4bd7-811b-19e1e9c8ed24'::uuid, false, 0.20, 'This is not a funding program for IIAL: Agriculture and Agri-Food Canada licenses its own agricultural technologies to companies that will commercialize them. IIAL, a nonprofit education and applied-research institute, would not be a licensee, although the agri-tech topics are close to its focus.'),
  ('4576723c-820f-48de-bb14-6ab30cbf16d4'::uuid, false, 0.45, 'IIAL cannot lead an Alliance grant: applicants must be university researchers, and partner organizations (which can be nonprofits like IIAL) join their project and contribute cash or in-kind. It is a realistic route only as a partner of a university researcher on an applied project in IIAL''s areas (supply chain, agri-tech, sustainability).'),
  ('f8083710-4078-41f0-99b1-6746ae8ed2bc'::uuid, false, 0.15, 'Not a fit: the BDC Equipment Purchase Loan is a repayable business loan for companies buying equipment. IIAL is a nonprofit institute and is looking for non-repayable funding, so this does not match.'),
  ('fbe60c55-5ec8-4930-86e7-1412b55ac6c8'::uuid, false, 0.15, 'Not a fit: the U.S. Army AI2C announcement funds fundamental artificial-intelligence research for defence. Foreign organizations may apply, but IIAL does not do AI research, so it has no credible basis for a proposal.'),
  ('c46a0e01-0a4a-4cba-8db3-d0aafdc9e631'::uuid, true, 0.30, 'IIAL is technically eligible, since the Canada Small Business Financing Program covers not-for-profit small businesses with revenue under $10 million, but it is a loan guarantee through a bank, not a grant. Low priority unless IIAL needs to finance equipment or leasehold improvements.'),
  ('a797c2be-5fbd-4039-aa08-ff92b0e5b569'::uuid, false, 0.10, 'Not a fit: CBDC Innovation Loans are repayable loans for businesses in the regions served by Atlantic Community Business Development Corporations, and IIAL is an Ontario nonprofit, not a business in those regions.'),
  ('e3645148-453a-46d1-84a4-aa7168b775b4'::uuid, false, 0.15, 'Not a fit: CENGN gives Canadian technology SMEs access to 5G and network test labs to commercialize products. IIAL is not a technology SME and has no network product to test.'),
  ('f7d62ba7-71a3-4755-8ac0-f83edd03d73c'::uuid, false, 0.15, 'Not a fit: CIHR funds health research led by researchers at eligible institutions. IIAL is not an eligible health-research institution and its work (professional education, supply chain integrity, agri-tech) is outside health research.'),
  ('886d1241-ef2f-493c-87b2-2d2bf4e25881'::uuid, false, 0.05, 'IIAL is not eligible: this Office of Minority Health opportunity is limited to private nonprofit or public entities located in a U.S. State or territory.'),
  ('a8fcd72f-df3d-4cca-aa67-24289c2245bf'::uuid, false, 0.10, 'Not a fit: the Communications Research Centre offers access to government wireless technologies and R&D collaboration for companies working in telecommunications, which is outside IIAL''s work.'),
  ('61ed2919-4111-437c-89dd-bd5ca855f12a'::uuid, false, 0.05, 'Not a fit: NIDA''s CEBRA award funds innovative basic research on substance use disorders. IIAL has no biomedical research program, so a competitive application is not realistic.'),
  ('41196080-2eea-40e2-8438-275328995ce6'::uuid, false, 0.05, 'IIAL is not eligible for the Dairy Innovation Program: it gives dairy processors access to extra milk to make innovative dairy products, and IIAL does not process dairy or hold a milk supply allotment.'),
  ('36dc87e3-5084-49f2-a528-c45f4725a75e'::uuid, false, 0.10, 'Not a fit: this NIH R01 funds dissemination and implementation research on evidence-based health interventions. IIAL does not run health-intervention research, so it cannot compete credibly.'),
  ('5f6bffcc-32bb-4b00-a174-5f8dd048dcc9'::uuid, false, 0.10, 'Not a fit: this NIH R03 funds small dissemination and implementation studies of evidence-based health interventions, which is outside IIAL''s education and supply-chain work.'),
  ('8f0572d1-70ab-472e-be87-27038757f81c'::uuid, false, 0.10, 'Not a fit: this NIH R21 funds exploratory dissemination and implementation research in health, outside IIAL''s expertise and track record.'),
  ('ab95f9aa-bb88-4a2a-976a-f5b1575d361f'::uuid, false, 0.15, 'Not a fit: Defence Research and Development Canada partnerships fund defence and security science and technology with universities and industry. IIAL''s work has no defence research component.'),
  ('f69c11cf-9973-4a6a-8460-13ebe41129f0'::uuid, false, 0.05, 'Not a fit: NCCIH funds feasibility clinical trials of mind and body health interventions. IIAL does not run clinical research.'),
  ('a2db6c3e-7d4c-4a2f-ab9c-8c88405d1cee'::uuid, false, 0.00, 'This is not a funding opportunity: it is a directory to find a licensed insolvency trustee for business restructuring or bankruptcy.'),
  ('3f55bad8-5ca2-4add-ab3a-8dbde7f6ee9b'::uuid, false, 0.05, 'IIAL is not eligible: Futurpreneur''s Start-Up Program lends to individual entrepreneurs aged 18 to 39 starting a business, not to established nonprofit institutes.'),
  ('3a3195b8-c141-45f9-ad31-0f194ddbdaab'::uuid, false, 0.05, 'IIAL is not eligible: Futurpreneur''s Newcomer Program lends to newcomer entrepreneurs aged 18 to 39 starting a business in Canada, not to organizations like IIAL.'),
  ('dcc0b8ff-4df4-4c4b-9ddf-34cde139ec53'::uuid, false, 0.05, 'Not a fit: this NOAA Fisheries announcement closed on September 30, 2026, and it funds U.S. fisheries science projects outside IIAL''s focus.'),
  ('2e94a15b-4fdb-43d8-b1fa-1d7a3d06be56'::uuid, true, 0.45, 'IIAL may be eligible, since Genome Canada opportunities are open to not-for-profit organizations for genomics R&D in areas such as agriculture. The fit is partial: IIAL works in agri-tech and supply chain integrity but has no genomics research capacity, so it would need an academic genomics partner. Confirm the current call and its eligibility on the official page.'),
  ('7d574043-1414-4910-9f8d-15107845fee5'::uuid, true, 0.50, 'IIAL can take part: Impact Canada challenges are generally open to nonprofits as well as businesses and individuals, and they fund innovative solutions to specific government problems. Whether it is worth it depends on the active challenge; ones on clean technology, agriculture or skills would suit IIAL. Check the open challenges and their criteria.'),
  ('fd20a77b-1c76-4ba5-917c-fad6373f6b7e'::uuid, false, 0.05, 'IIAL is not eligible: CanNor''s IDEANorth funds organizations and projects in Yukon, the Northwest Territories and Nunavut, and IIAL is based in Ontario.'),
  ('9e3868c2-7084-4eaa-91b5-e7e31efeb2ec'::uuid, false, 0.05, 'Not a fit: NCCIH funds remotely delivered clinical trials of complementary and integrative health interventions. IIAL does not run clinical trials.'),
  ('37e33ebb-77e6-4263-8621-36dcc66c2ebe'::uuid, false, 0.00, 'IIAL is not eligible: this limited competition is only for NCATS CTSA KL2 scholars and re-entry supplement recipients.'),
  ('4d9d93f6-f708-4d98-ac09-321e117084ff'::uuid, false, 0.05, 'IIAL is not eligible: this Office of Minority Health dementia opportunity is limited to private nonprofit or public entities located in a U.S. State or territory.'),
  ('43bf1042-734e-45a4-9a77-84e30aa33991'::uuid, false, 0.05, 'Not a fit: the Matching Investment Fund supports product development that increases demand for Canadian dairy products and ingredients. IIAL does not develop dairy products.'),
  ('4ca0264d-32b9-4193-896f-948e3ced8470'::uuid, true, 0.75, 'IIAL is a good fit for Mitacs Accelerate: Canadian not-for-profit corporations can be partner organizations, and the program co-funds research internships in which graduate students and postdocs work on the partner''s research problem with a university supervisor. That matches IIAL''s applied research with postsecondary partners. Each four- to six-month internship requires a partner contribution of about $7,500 (or $10,000 for postdoctoral units), and the project must show an economic benefit.'),
  ('bb0208d2-c7ec-4aa4-a80a-ed76bda7be89'::uuid, false, 0.05, 'Not a fit: this opportunity funds a U.S. national training center for Title X family planning and Teen Pregnancy Prevention grantees, which is outside IIAL''s mission and geography.'),
  ('ace8ebab-7475-450b-a600-e1018c875af5'::uuid, false, 0.05, 'Not a fit: this opportunity funds a U.S. national training center for Title X and Teen Pregnancy Prevention grantees, which is outside IIAL''s mission and geography.'),
  ('71d4a072-ce3e-4b4f-992c-05d31b15adf9'::uuid, false, 0.05, 'Not a fit: NIMH funds development of brain stimulation devices for mental health disorders. IIAL has no medical device research capability.'),
  ('ad2fdaac-9a21-4671-8a07-364f2e23af1c'::uuid, false, 0.10, 'IIAL is not eligible: FedNor youth internships for not-for-profits are limited to organizations in Northern Ontario, and IIAL is based in Aurora, in southern Ontario.'),
  ('a429fbdb-0cd4-4c8c-b99a-48bcec94245f'::uuid, false, 0.15, 'This is not a grant: the NRC Advanced Electronics and Photonics Research Centre offers fee-based technical services, facilities and licensing for semiconductor research, which is outside IIAL''s work.'),
  ('cae00f0d-11b0-4a9a-8008-e2eb0a2f5136'::uuid, false, 0.10, 'This is not a grant: the NRC Aerospace Research Centre offers fee-based services and collaboration for aerospace research, outside IIAL''s focus.'),
  ('74bed51a-73c0-40c5-94f7-a1befeea1934'::uuid, false, 0.20, 'This is not a grant: the NRC Aquatic and Crop Resource Development centre offers fee-for-service facilities and collaboration to companies developing crop and natural health products. It is relevant to agri-tech, but IIAL would pay for services rather than receive funding.'),
  ('de38ee01-d61f-4b35-811e-95ad98fedf45'::uuid, false, 0.10, 'This is not a grant: the NRC Automotive and Surface Transportation centre offers fee-based services and collaboration for automotive research, outside IIAL''s focus.'),
  ('30cf00ab-fa48-487d-b447-cfb9a0e9464e'::uuid, false, 0.20, 'Not a fit: the NRC Construction Research Centre offers technical services, and its challenge calls fund construction-sector research. Nonprofits can collaborate, but construction digitalization is outside IIAL''s areas.'),
  ('f71cfb73-ecd2-45ce-99b0-0c6edefc928a'::uuid, false, 0.20, 'This is not a grant for IIAL: the NRC Energy, Mining and Environment centre provides research services and collaborations on clean energy and environmental technologies. It is thematically close to IIAL''s sustainability work but offers no direct funding.'),
  ('17947651-e6cc-4fb8-bfea-699e34b1a922'::uuid, false, 0.05, 'This is not a grant: the NRC Human Health Therapeutics centre offers services and collaboration for biologics and therapeutics research, outside IIAL''s work.'),
  ('40ea3d88-26f2-49a4-916b-90542c3bcfb6'::uuid, false, 0.05, 'This is not a grant: the NRC Medical Devices centre offers services and collaboration for medical device research, outside IIAL''s work.'),
  ('f0540732-e99f-4581-8614-20585a84cf8a'::uuid, false, 0.10, 'This is not a grant: the NRC Metrology Research Centre offers measurement science services and collaboration, outside IIAL''s focus.'),
  ('bf6c556b-413d-4d2b-966c-0f0fd366d8e9'::uuid, false, 0.10, 'This is not a grant: the NRC Ocean, Coastal and River Engineering centre offers engineering research services, outside IIAL''s focus.'),
  ('453c767a-a620-4bf0-ba51-5a3d19a0ad84'::uuid, false, 0.05, 'This is not a grant: the NRC Quantum and Nanotechnologies centre offers research services in materials, photonics and quantum devices, outside IIAL''s work.'),
  ('e76b3a6d-afd1-4966-8986-add601be2491'::uuid, false, 0.10, 'IIAL is not eligible: NRC IRAP financial assistance is limited to incorporated, for-profit small and medium-sized enterprises in Canada, and IIAL is a nonprofit.'),
  ('d7d78d0c-48a8-4177-8623-a939990b6eb4'::uuid, false, 0.10, 'IIAL is not eligible: NRC IRAP advisory services are offered to incorporated, for-profit small and medium-sized enterprises, not nonprofits.'),
  ('8d1ed175-7fd8-409c-8271-bd3ccb80183b'::uuid, false, 0.10, 'IIAL is not eligible: the NRC IRAP Youth Employment Program funds hiring by incorporated, for-profit SMEs, and IIAL is a nonprofit.'),
  ('d9aa3477-b02c-4cd6-8227-c4b5037f7c9a'::uuid, false, 0.05, 'Not a fit: this NIH R01 funds population research on alcohol-related cancer risk, which is outside IIAL''s expertise.'),
  ('7a34b814-322b-4f55-8872-0c5720ccef11'::uuid, false, 0.05, 'IIAL is not eligible: this Office on Women''s Health opportunity is limited to private or public entities located in a U.S. State or territory.'),
  ('f1306413-ab69-4efa-a84e-0ab149be593c'::uuid, false, 0.05, 'IIAL is not eligible: this Office of Minority Health opportunity is limited to private nonprofit or public entities located in a U.S. State or territory.'),
  ('8aaf31d7-c0cc-4623-a736-435004b7b5eb'::uuid, false, 0.05, 'IIAL is not eligible: REAP funds research at U.S. health professional and graduate schools that have not been major NIH recipients.'),
  ('d0a4bca6-7e14-4c08-9792-26514bc5e38e'::uuid, false, 0.10, 'Not a fit: SR&ED is a tax incentive claimed by taxable businesses that perform R&D. As a nonprofit, IIAL would get little or no benefit, and it is not a grant.'),
  ('a438443d-0322-482e-8487-e94915008ce6'::uuid, false, 0.15, 'Not a fit: SOFII offers interest-bearing loans to high-growth, innovative small and medium-sized businesses in southern Ontario. IIAL is a nonprofit institute, and these are repayable loans, not grants.'),
  ('a61c0522-2c3e-41e7-90c3-0f217962a765'::uuid, false, 0.15, 'Not a fit: the Space Technology Development Program funds mission-enabling and generic space technologies, which is outside IIAL''s work in education, supply chain integrity and agri-tech.'),
  ('02e6bb05-30c4-4fda-a74e-bb6fe61a8115'::uuid, false, 0.15, 'IIAL is not eligible: the Canadian International Innovation Program funds Canadian SMEs doing joint R&D with an industry partner abroad, and IIAL is not an SME.'),
  ('69f838ee-ddcc-4ee3-86c6-95619267d1cc'::uuid, true, 0.60, 'IIAL looks eligible for CanExport Innovation: it funds Canadian organizations, including not-for-profit research organizations, to pursue and sign R&D agreements with international partners (up to $75,000). It fits IIAL''s applied research and its Latin American activities. Confirm that IIAL meets the research-organization requirements and that the partnership leads to an R&D agreement.'),
  ('5ef681d6-0afa-4e5b-860a-31cbf2057d25'::uuid, false, 0.15, 'IIAL is not eligible: CanExport SMEs funds for-profit small and medium-sized businesses entering new export markets, and IIAL is a nonprofit.'),
  ('630dc349-8e52-477a-838f-b425b3ec3490'::uuid, false, 0.15, 'Not a fit: the U.S. Embassy in Cairo funds programs that strengthen U.S.-Egypt ties, normally through U.S. or Egyptian organizations. A Canadian institute like IIAL would have no strong case.'),
  ('94c73d46-2020-4c10-868c-9fe116a8ed37'::uuid, false, 0.00, 'IIAL is not eligible: the University Nuclear Leadership Program funds scholarships at accredited U.S. colleges and universities.')
),
members AS (
  SELECT user_id FROM public.user_organizations WHERE org_id = '7a1c0d2e-0000-4a11-9a11-11a1c0d2e001'
  UNION
  SELECT user_id FROM public.org_profiles WHERE org_id = '7a1c0d2e-0000-4a11-9a11-11a1c0d2e001' AND user_id IS NOT NULL
)
INSERT INTO public.grant_evaluations
  (user_id, grant_id, fit_score, llm_fit_score, eligibility_pass, rationale_en, rationale_fr,
   model, prompt_version, evaluated_at, rule_snapshot)
SELECT m.user_id, r.grant_id, r.fit, r.fit, r.eligible, r.rationale, NULL,
       'claude-opus-5-5', '1.2.0', now(),
       jsonb_build_object('is_exhaustive', true, 'reviewed_by', 'claude', 'verdict',
         CASE WHEN r.eligible THEN 'eligible' ELSE 'ineligible' END)
FROM review r CROSS JOIN members m
WHERE EXISTS (SELECT 1 FROM public.grants g WHERE g.id = r.grant_id)
ON CONFLICT (user_id, grant_id) DO UPDATE SET
  fit_score = EXCLUDED.fit_score,
  llm_fit_score = EXCLUDED.llm_fit_score,
  eligibility_pass = EXCLUDED.eligibility_pass,
  rationale_en = EXCLUDED.rationale_en,
  rationale_fr = NULL,
  model = EXCLUDED.model,
  prompt_version = EXCLUDED.prompt_version,
  evaluated_at = EXCLUDED.evaluated_at,
  -- keep the rule checks already stored, mark the review final
  rule_snapshot = COALESCE(public.grant_evaluations.rule_snapshot, '{}'::jsonb)
    || EXCLUDED.rule_snapshot;

-- Check: every member now has 60 final reviews.
SELECT e.user_id, count(*) AS reviews,
       count(*) FILTER (WHERE e.eligibility_pass) AS eligible,
       count(*) FILTER (WHERE e.model = 'claude-opus-5-5') AS by_claude
FROM public.grant_evaluations e
WHERE e.user_id IN (
  SELECT user_id FROM public.user_organizations WHERE org_id = '7a1c0d2e-0000-4a11-9a11-11a1c0d2e001'
  UNION SELECT user_id FROM public.org_profiles WHERE org_id = '7a1c0d2e-0000-4a11-9a11-11a1c0d2e001' AND user_id IS NOT NULL)
GROUP BY e.user_id;
