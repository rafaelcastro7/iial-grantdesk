SET check_function_bodies = off;

CREATE TABLE public.discovery_config (
    is_singleton boolean DEFAULT true NOT NULL,
    max_pages_per_run integer DEFAULT 15 NOT NULL,
    scrape_concurrency integer DEFAULT 3 NOT NULL,
    fallback_max_links integer DEFAULT 12 NOT NULL,
    firecrawl_search_query text DEFAULT 'program funding grant subvention financement'::text NOT NULL,
    extra_non_grant_url_patterns text[] DEFAULT '{}'::text[] NOT NULL,
    extra_root_index_paths text[] DEFAULT '{}'::text[] NOT NULL,
    extra_program_hint_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    extra_non_program_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    funder_scout_queries text[] DEFAULT '{}'::text[] NOT NULL,
    extra_rss_feeds jsonb DEFAULT '[]'::jsonb NOT NULL,
    candidate_auto_approve_threshold integer DEFAULT 80 NOT NULL,
    candidate_review_min_threshold integer DEFAULT 40 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT discovery_config_candidate_auto_approve_threshold_check CHECK (((candidate_auto_approve_threshold >= 0) AND (candidate_auto_approve_threshold <= 100))),
    CONSTRAINT discovery_config_candidate_review_min_threshold_check CHECK (((candidate_review_min_threshold >= 0) AND (candidate_review_min_threshold <= 100))),
    CONSTRAINT discovery_config_fallback_max_links_check CHECK (((fallback_max_links >= 1) AND (fallback_max_links <= 100))),
    CONSTRAINT discovery_config_is_singleton_check CHECK (is_singleton),
    CONSTRAINT discovery_config_max_pages_per_run_check CHECK (((max_pages_per_run >= 1) AND (max_pages_per_run <= 100))),
    CONSTRAINT discovery_config_scrape_concurrency_check CHECK (((scrape_concurrency >= 1) AND (scrape_concurrency <= 20)))
);

CREATE TABLE public.discovery_registration_gates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funder_id uuid,
    url text NOT NULL,
    reason text NOT NULL,
    snippet text,
    status text DEFAULT 'pending'::text NOT NULL,
    first_detected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_detected_at timestamp with time zone DEFAULT now() NOT NULL,
    times_seen integer DEFAULT 1 NOT NULL,
    resolved_at timestamp with time zone,
    resolved_note text,
    CONSTRAINT discovery_registration_gates_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'registered'::text, 'not_needed'::text])))
);

CREATE TABLE public.discovery_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funder_id uuid NOT NULL,
    url text NOT NULL,
    content_hash text,
    etag text,
    last_modified text,
    http_status integer,
    text_length integer,
    grants_found integer DEFAULT 0 NOT NULL,
    grants_inserted integer DEFAULT 0 NOT NULL,
    times_seen integer DEFAULT 1 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_url text
);

CREATE TABLE public.discovery_sources_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dataset_key text NOT NULL,
    label text NOT NULL,
    tier text NOT NULL,
    format text NOT NULL,
    source_url text,
    cadence_cron text,
    enabled boolean DEFAULT true NOT NULL,
    last_run_at timestamp with time zone,
    last_status text,
    last_error text,
    rows_30d integer DEFAULT 0 NOT NULL,
    candidates_30d integer DEFAULT 0 NOT NULL,
    auto_approved_30d integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_label text NOT NULL,
    recovery_playbook text NOT NULL,
    expected_refresh_hours integer NOT NULL,
    coverage_dimensions text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT discovery_sources_refresh_hours_check CHECK (((expected_refresh_hours >= 1) AND (expected_refresh_hours <= 8760))),
    CONSTRAINT discovery_sources_registry_tier_check CHECK ((tier = ANY (ARRAY['A_daily'::text, 'B_weekly'::text, 'C_monthly'::text, 'scout'::text])))
);

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    storage_path text NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documents_entity_type_check CHECK ((entity_type = ANY (ARRAY['grant'::text, 'proposal'::text, 'submission'::text, 'funder'::text])))
);

CREATE TABLE public.dsar_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind public.dsar_kind NOT NULL,
    status public.dsar_status DEFAULT 'pending'::public.dsar_status NOT NULL,
    reason text,
    result_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

CREATE TABLE public.evidence_spans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grant_id uuid NOT NULL,
    agent text NOT NULL,
    field text NOT NULL,
    value jsonb,
    source_url text NOT NULL,
    source_hash text,
    snippet text NOT NULL,
    snippet_offset integer,
    extraction_method text NOT NULL,
    confidence numeric(3,2) DEFAULT 0.5 NOT NULL,
    model text,
    run_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidence_spans_agent_check CHECK ((agent = ANY (ARRAY['discoverer'::text, 'enricher'::text, 'evaluator'::text, 'strategist'::text, 'writer'::text, 'critic'::text]))),
    CONSTRAINT evidence_spans_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT evidence_spans_extraction_method_check CHECK ((extraction_method = ANY (ARRAY['regex'::text, 'chrono'::text, 'rule'::text, 'firecrawl_json'::text, 'llm'::text, 'manual'::text])))
);

CREATE TABLE public.fit_rules (
    user_id uuid NOT NULL,
    min_amount_cad numeric,
    max_amount_cad numeric,
    required_jurisdictions text[] DEFAULT '{}'::text[] NOT NULL,
    excluded_jurisdictions text[] DEFAULT '{}'::text[] NOT NULL,
    required_sectors text[] DEFAULT '{}'::text[] NOT NULL,
    excluded_sectors text[] DEFAULT '{}'::text[] NOT NULL,
    required_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    excluded_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    min_days_to_deadline integer,
    weight_llm numeric DEFAULT 0.5 NOT NULL,
    threshold_fit_pass integer DEFAULT 60 NOT NULL,
    hard_fail_on_jurisdiction boolean DEFAULT true NOT NULL,
    hard_fail_on_excluded_keyword boolean DEFAULT true NOT NULL,
    hard_fail_on_amount boolean DEFAULT false NOT NULL,
    hard_fail_on_deadline boolean DEFAULT false NOT NULL,
    auto_archive_on_fail boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applicant_types_allowed text[] DEFAULT '{}'::text[] NOT NULL,
    applicant_types_excluded text[] DEFAULT '{}'::text[] NOT NULL,
    lead_min_weeks integer,
    partner_min_weeks integer,
    iial_capabilities text[] DEFAULT '{}'::text[] NOT NULL,
    max_cost_share_pct_org_carries numeric,
    require_match_verification boolean DEFAULT false NOT NULL,
    rolling_intake_passes_runway boolean DEFAULT true NOT NULL,
    hard_fail_on_applicant_type boolean DEFAULT true NOT NULL,
    hard_fail_on_runway boolean DEFAULT true NOT NULL,
    hard_fail_on_capability boolean DEFAULT false NOT NULL,
    CONSTRAINT fit_rules_threshold_fit_pass_check CHECK (((threshold_fit_pass >= 0) AND (threshold_fit_pass <= 100))),
    CONSTRAINT fit_rules_weight_llm_check CHECK (((weight_llm >= (0)::numeric) AND (weight_llm <= (1)::numeric)))
);

CREATE TABLE public.funder_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    name_fr text,
    bn_number text,
    province text,
    funder_type text,
    website text,
    source_signals text[] DEFAULT '{}'::text[] NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending_review'::text NOT NULL,
    raw_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reject_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    disbursed_annual numeric,
    CONSTRAINT funder_candidates_status_chk CHECK ((status = ANY (ARRAY['candidate'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text])))
);

ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS name_fr text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS source_type public.funder_source_type DEFAULT 'manual'::public.funder_source_type NOT NULL;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS last_discovered_at timestamp with time zone;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS last_content_hash text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS bn_number text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS disbursed_annual numeric;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS charity_status text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS effective_date text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS telephone text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS accounting_period_end text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS data_source text;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS data_year integer;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS total_revenue numeric;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS total_expenditures numeric;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS program_expenditures numeric;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS admin_expenditures numeric;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS fundraising_expenditures numeric;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS charitable_programs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS directors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.funders ADD COLUMN IF NOT EXISTS giving_history jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS title_fr text;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS summary_fr text;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS amount_cad_min numeric(14,2);
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS amount_cad_max numeric(14,2);
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS eligibility jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS sectors text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE public.grants ALTER COLUMN status SET DEFAULT 'discovered';
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS fit_score numeric(4,3);
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS discovered_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS enriched_at timestamp with time zone;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS scored_at timestamp with time zone;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS times_seen integer DEFAULT 1 NOT NULL;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS canonical_key text;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS enrich_attempts integer DEFAULT 0 NOT NULL;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS enrich_last_error text;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS enrich_last_attempt_at timestamp with time zone;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS requirements jsonb;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS confirmed_source_urls jsonb;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS applicant_types text[];
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS populations_served text[];
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS funding_uses text[];
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS funder_type text;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS deadline_kind text;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS deadline_confidence numeric(3,2);
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS next_expected_open date;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS next_expected_deadline date;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS source_freshness_at timestamp with time zone;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS source_confidence numeric(3,2);
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS next_expected_deadline_confidence numeric(3,2);
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS next_expected_deadline_basis text;

CREATE VIEW public.funder_source_yield WITH (security_invoker='true') AS
 SELECT f.id AS funder_id, f.name, f.source_type,
    count(g.id) AS grants_total,
    count(g.id) FILTER (WHERE (g.created_at >= (now() - '30 days'::interval))) AS grants_30d,
    max(g.created_at) AS last_grant_at
   FROM (public.funders f LEFT JOIN public.grants g ON ((g.funder_id = f.id)))
  GROUP BY f.id, f.name, f.source_type;

CREATE TABLE public.grant_deadline_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grant_id uuid NOT NULL,
    observed_deadline date NOT NULL,
    source_url text NOT NULL,
    evidence_span_id uuid,
    observed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.grant_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    grant_id uuid NOT NULL,
    fit_score numeric(4,3) NOT NULL,
    rationale_en text NOT NULL,
    rationale_fr text,
    eligibility_pass boolean DEFAULT true NOT NULL,
    model text NOT NULL,
    prompt_version text NOT NULL,
    run_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    axis_breakdown jsonb,
    llm_fit_score numeric(4,3),
    rule_snapshot jsonb,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grant_evaluations_fit_score_check CHECK (((fit_score >= (0)::numeric) AND (fit_score <= (1)::numeric))),
    CONSTRAINT grant_evaluations_llm_fit_score_check CHECK (((llm_fit_score IS NULL) OR ((llm_fit_score >= (0)::numeric) AND (llm_fit_score <= (1)::numeric))))
);

CREATE TABLE public.grant_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grant_id uuid NOT NULL,
    from_status text,
    to_status text NOT NULL,
    actor_user_id uuid,
    actor_agent text,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.grant_search_benchmark_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ranking_version text NOT NULL,
    k integer NOT NULL,
    summary jsonb NOT NULL,
    coverage jsonb NOT NULL,
    stale_case_ids text[] DEFAULT '{}'::text[] NOT NULL,
    thresholds_passed boolean NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grant_search_benchmark_runs_k_check CHECK ((k > 0))
);

CREATE TABLE public.grant_search_documents (
    grant_id uuid NOT NULL,
    content_en text NOT NULL,
    content_fr text DEFAULT ''::text NOT NULL,
    content_hash text NOT NULL,
    embedding public.vector(768),
    embedding_model text,
    embedded_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.grant_search_feedback_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    grant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    reason text,
    note text,
    query_text text,
    rank_position integer,
    score_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grant_search_feedback_events_action_check CHECK ((action = ANY (ARRAY['saved'::text, 'hidden'::text, 'rejected'::text, 'restored'::text, 'pursued'::text])))
);

CREATE TABLE public.grant_search_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid,
    name text NOT NULL,
    mission text DEFAULT ''::text NOT NULL,
    activities text[] DEFAULT '{}'::text[] NOT NULL,
    populations_served text[] DEFAULT '{}'::text[] NOT NULL,
    funding_uses text[] DEFAULT '{}'::text[] NOT NULL,
    sectors text[] DEFAULT '{}'::text[] NOT NULL,
    jurisdictions text[] DEFAULT '{CA}'::text[] NOT NULL,
    applicant_types text[] DEFAULT '{}'::text[] NOT NULL,
    amount_min_cad numeric(14,2),
    amount_max_cad numeric(14,2),
    project_start date,
    project_end date,
    role text DEFAULT 'either'::text NOT NULL,
    required_terms text[] DEFAULT '{}'::text[] NOT NULL,
    excluded_terms text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    peer_organizations text[] DEFAULT '{}'::text[] NOT NULL,
    last_reviewed_at timestamp with time zone,
    CONSTRAINT grant_search_profiles_amount_max_cad_check CHECK (((amount_max_cad IS NULL) OR (amount_max_cad >= (0)::numeric))),
    CONSTRAINT grant_search_profiles_amount_min_cad_check CHECK (((amount_min_cad IS NULL) OR (amount_min_cad >= (0)::numeric))),
    CONSTRAINT grant_search_profiles_check CHECK (((amount_min_cad IS NULL) OR (amount_max_cad IS NULL) OR (amount_min_cad <= amount_max_cad))),
    CONSTRAINT grant_search_profiles_check1 CHECK (((project_start IS NULL) OR (project_end IS NULL) OR (project_start <= project_end))),
    CONSTRAINT grant_search_profiles_mission_check CHECK ((char_length(mission) <= 4000)),
    CONSTRAINT grant_search_profiles_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 120))),
    CONSTRAINT grant_search_profiles_role_check CHECK ((role = ANY (ARRAY['lead'::text, 'partner'::text, 'either'::text])))
);

CREATE TABLE public.grant_search_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid,
    profile_id uuid,
    query_text text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    candidate_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    latency_ms integer NOT NULL,
    fusion_weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    index_version text NOT NULL,
    embedding_model text,
    taxonomy_version text NOT NULL,
    ranking_version text NOT NULL,
    retrieval_mode text NOT NULL,
    degraded_reason text,
    result_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grant_search_runs_latency_ms_check CHECK ((latency_ms >= 0)),
    CONSTRAINT grant_search_runs_query_text_check CHECK (((char_length(query_text) >= 2) AND (char_length(query_text) <= 500))),
    CONSTRAINT grant_search_runs_retrieval_mode_check CHECK ((retrieval_mode = ANY (ARRAY['hybrid'::text, 'lexical-fallback'::text, 'lexical-only'::text, 'shadow'::text])))
);

CREATE TABLE public.grant_search_runtime_config (
    is_singleton boolean DEFAULT true NOT NULL,
    hybrid_enabled boolean DEFAULT true NOT NULL,
    shadow_mode boolean DEFAULT false NOT NULL,
    ranking_version text DEFAULT 'hybrid_rrf_v2'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT grant_search_runtime_config_is_singleton_check CHECK (is_singleton)
);

CREATE TABLE public.knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source text NOT NULL,
    source_kind text DEFAULT 'org_profile'::text NOT NULL,
    language public.app_lang DEFAULT 'en'::public.app_lang NOT NULL,
    content text NOT NULL,
    embedding public.vector(768),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);

CREATE TABLE public.logic_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    inputs jsonb DEFAULT '[]'::jsonb NOT NULL,
    activities jsonb DEFAULT '[]'::jsonb NOT NULL,
    outputs jsonb DEFAULT '[]'::jsonb NOT NULL,
    outcomes jsonb DEFAULT '[]'::jsonb NOT NULL,
    impact jsonb DEFAULT '[]'::jsonb NOT NULL,
    assumptions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.module_flags (
    module text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    description_fr text DEFAULT ''::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    grant_id uuid,
    kind text NOT NULL,
    title_en text NOT NULL,
    title_fr text NOT NULL,
    body_en text NOT NULL,
    body_fr text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_kind_check CHECK ((kind = ANY (ARRAY['deadline'::text, 'decision'::text, 'reminder'::text, 'system'::text, 'strong_fit'::text])))
);

CREATE TABLE public.org_profiles (
    user_id uuid NOT NULL,
    org_name text NOT NULL,
    sectors text[] DEFAULT '{}'::text[] NOT NULL,
    jurisdictions text[] DEFAULT '{CA}'::text[] NOT NULL,
    stage public.org_stage DEFAULT 'sme'::public.org_stage NOT NULL,
    annual_budget_cad numeric(14,2),
    focus_areas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid,
    legal_name text,
    business_number text,
    website text,
    mission text,
    applicant_types text[] DEFAULT '{}'::text[] NOT NULL,
    activities text[] DEFAULT '{}'::text[] NOT NULL,
    capabilities text[] DEFAULT '{}'::text[] NOT NULL,
    populations_served text[] DEFAULT '{}'::text[] NOT NULL,
    operating_regions text[] DEFAULT '{}'::text[] NOT NULL,
    languages text[] DEFAULT '{en}'::text[] NOT NULL,
    years_operating integer,
    employee_count integer,
    registration_status text,
    funding_min_cad numeric(14,2),
    funding_max_cad numeric(14,2),
    cost_share_max_pct numeric(5,2),
    indirect_cost_rate_pct numeric(5,2),
    profile_evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    profile_updated_by uuid,
    CONSTRAINT org_profiles_cost_share_check CHECK (((cost_share_max_pct IS NULL) OR ((cost_share_max_pct >= (0)::numeric) AND (cost_share_max_pct <= (100)::numeric)))),
    CONSTRAINT org_profiles_employee_count_check CHECK (((employee_count IS NULL) OR ((employee_count >= 0) AND (employee_count <= 10000000)))),
    CONSTRAINT org_profiles_funding_range_check CHECK ((((funding_min_cad IS NULL) OR (funding_min_cad >= (0)::numeric)) AND ((funding_max_cad IS NULL) OR (funding_max_cad >= (0)::numeric)) AND ((funding_min_cad IS NULL) OR (funding_max_cad IS NULL) OR (funding_min_cad <= funding_max_cad)))),
    CONSTRAINT org_profiles_indirect_cost_check CHECK (((indirect_cost_rate_pct IS NULL) OR ((indirect_cost_rate_pct >= (0)::numeric) AND (indirect_cost_rate_pct <= (100)::numeric)))),
    CONSTRAINT org_profiles_registration_status_check CHECK (((registration_status IS NULL) OR (registration_status = ANY (ARRAY['registered_charity'::text, 'nonprofit'::text, 'for_profit'::text, 'public_body'::text, 'academic'::text, 'indigenous'::text, 'unregistered'::text, 'other'::text])))),
    CONSTRAINT org_profiles_years_operating_check CHECK (((years_operating IS NULL) OR ((years_operating >= 0) AND (years_operating <= 500))))
);

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    grant_id uuid NOT NULL,
    result text NOT NULL,
    amount_awarded_cad numeric(14,2),
    decision_date date,
    feedback text,
    lessons_learned text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    impact_description text,
    CONSTRAINT outcomes_result_check CHECK ((result = ANY (ARRAY['won'::text, 'lost'::text, 'withdrawn'::text, 'no_response'::text])))
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    org_name text,
    country text DEFAULT 'CA'::text NOT NULL,
    preferred_lang public.app_lang DEFAULT 'en'::public.app_lang NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);

CREATE TABLE public.proposal_citation_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.proposal_citations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    chunk_id uuid NOT NULL,
    user_id uuid NOT NULL,
    marker text NOT NULL,
    snippet text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.proposal_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    overall_score numeric(3,1) NOT NULL,
    reviewer_scores jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS kind public.section_kind;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS ord integer DEFAULT 0 NOT NULL;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS heading_en text;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS heading_fr text;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS content_en text DEFAULT ''::text NOT NULL;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS content_fr text;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS critic_notes jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.proposal_sections ADD COLUMN IF NOT EXISTS human_edited boolean DEFAULT false NOT NULL;

CREATE TABLE public.proposal_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    name text NOT NULL,
    name_fr text,
    description text,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_global boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS language public.app_lang DEFAULT 'en'::public.app_lang NOT NULL;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS critic_score numeric(3,2);
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS budget_total_cad numeric;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS human_reviewed_at timestamp with time zone;

CREATE TABLE public.shared_fit_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    grant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    revoked boolean DEFAULT false NOT NULL
);

CREATE VIEW public.source_coverage_accountability WITH (security_invoker='true') AS
 SELECT id, dataset_key, label, tier, enabled, owner_label, recovery_playbook, expected_refresh_hours,
    coverage_dimensions, last_run_at, last_status, last_error,
        CASE
            WHEN (NOT enabled) THEN 'disabled'::text
            WHEN (last_run_at IS NULL) THEN 'never_run'::text
            WHEN (last_status = 'failed'::text) THEN 'failed'::text
            WHEN (last_run_at < (now() - make_interval(hours => expected_refresh_hours))) THEN 'overdue'::text
            ELSE 'healthy'::text
        END AS accountable_state,
        CASE
            WHEN (last_run_at IS NULL) THEN NULL::numeric
            ELSE (EXTRACT(epoch FROM (now() - last_run_at)) / (3600)::numeric)
        END AS age_hours
   FROM public.discovery_sources_registry r;

CREATE TABLE public.source_ingest_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dataset text NOT NULL,
    rows_in integer DEFAULT 0 NOT NULL,
    candidates_out integer DEFAULT 0 NOT NULL,
    auto_approved integer DEFAULT 0 NOT NULL,
    duplicates integer DEFAULT 0 NOT NULL,
    errors integer DEFAULT 0 NOT NULL,
    latency_ms integer,
    status text DEFAULT 'succeeded'::text NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE VIEW public.source_health_summary WITH (security_invoker='true') AS
 SELECT dataset, count(*) AS runs,
    ((count(*) FILTER (WHERE (status = 'succeeded'::text)))::double precision / (NULLIF(count(*), 0))::double precision) AS success_rate,
    (COALESCE(sum(rows_in), (0)::bigint))::integer AS rows_in_total,
    (COALESCE(sum(candidates_out), (0)::bigint))::integer AS candidates_total,
    (COALESCE(sum(auto_approved), (0)::bigint))::integer AS auto_approved_total,
    (COALESCE(sum(errors), (0)::bigint))::integer AS errors_total,
    (avg(latency_ms))::integer AS avg_latency_ms,
    max(run_at) AS last_run_at
   FROM public.source_ingest_runs
  WHERE (run_at >= (now() - '30 days'::interval))
  GROUP BY dataset;

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grant_id uuid;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS language public.app_lang DEFAULT 'en'::public.app_lang NOT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS human_edited_pct numeric;

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    assigned_to uuid,
    created_by uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);

CREATE TABLE public.user_organizations (
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_organizations_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])))
);

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.webhook_config (
    key text NOT NULL,
    value text NOT NULL,
    rotated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.webhook_nonces (
    nonce text NOT NULL,
    endpoint text NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.webhook_rate_limit (
    id bigint NOT NULL,
    endpoint text NOT NULL,
    client_ip text NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.webhook_rate_limit_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.webhook_rate_limit_id_seq OWNED BY public.webhook_rate_limit.id;
ALTER TABLE ONLY public.webhook_rate_limit ALTER COLUMN id SET DEFAULT nextval('public.webhook_rate_limit_id_seq'::regclass);

ALTER TABLE ONLY public.agent_config_audit ADD CONSTRAINT agent_config_audit_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.agent_configs ADD CONSTRAINT agent_configs_pkey PRIMARY KEY (agent);