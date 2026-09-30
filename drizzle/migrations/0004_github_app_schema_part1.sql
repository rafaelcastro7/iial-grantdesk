SET check_function_bodies = off;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
ALTER TABLE public.grants ALTER COLUMN source_key DROP NOT NULL;
ALTER TABLE public.answer_library ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.answer_library ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.proposals ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.proposal_sections ALTER COLUMN heading DROP NOT NULL;
ALTER TABLE public.submissions ALTER COLUMN human_reviewed_by DROP NOT NULL;
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_client_id_grant_id_key;
UPDATE public.grants SET status = 'discovered' WHERE status NOT IN ('discovered','enriched','scored','shortlisted','in_proposal','submitted','won','lost','expired','archived');

CREATE TYPE public.agent_name AS ENUM ('discoverer','enricher','evaluator','strategist','writer','critic');
CREATE TYPE public.agent_status AS ENUM ('running','succeeded','failed','degraded');
CREATE TYPE public.app_lang AS ENUM ('en','fr');
CREATE TYPE public.app_role AS ENUM ('admin','member','viewer');
CREATE TYPE public.consent_action AS ENUM ('granted','revoked');
CREATE TYPE public.consent_type AS ENUM ('terms_of_service','privacy_policy','ai_processing','cross_border_transfer','marketing');
CREATE TYPE public.dsar_kind AS ENUM ('access','export','delete','rectify');
CREATE TYPE public.dsar_status AS ENUM ('pending','processing','completed','rejected');
CREATE TYPE public.funder_source_type AS ENUM ('rss','api','html','manual');
CREATE TYPE public.grant_status AS ENUM ('discovered','enriched','scored','shortlisted','in_proposal','submitted','won','lost','expired','archived');
CREATE TYPE public.org_stage AS ENUM ('startup','sme','nonprofit','research','public_sector');
CREATE TYPE public.proposal_status AS ENUM ('draft','in_review','submitted','accepted','rejected','withdrawn');
CREATE TYPE public.section_kind AS ENUM ('summary','problem','solution','impact','budget','team','timeline','sustainability','evaluation','other');

CREATE OR REPLACE FUNCTION public.auto_promote_stale_candidates() RETURNS TABLE(promoted_id uuid, name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM public.funder_candidates
    WHERE status='pending_review'
      AND score >= 70
      AND array_length(source_signals,1) >= 2
      AND discovered_at <= now() - interval '7 days'
    LIMIT 50
  LOOP
    INSERT INTO public.funders (name, name_fr, country, jurisdiction, website, source_url, source_type, bn_number, disbursed_annual, active)
    VALUES (rec.name, rec.name_fr, 'CA', rec.province, rec.website, rec.website, 'manual', rec.bn_number, rec.disbursed_annual, true)
    ON CONFLICT DO NOTHING;
    UPDATE public.funder_candidates
      SET status='approved', reviewed_at=now(), reviewed_by=NULL
      WHERE id=rec.id;
    promoted_id := rec.id;
    name := rec.name;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_proposal_version(target_proposal_id uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE next_version integer;
BEGIN
  UPDATE public.proposals SET version = greatest(coalesce(version,1),1)+1
   WHERE id = target_proposal_id AND user_id = auth.uid()
   RETURNING version INTO next_version;
  IF next_version IS NULL THEN RAISE EXCEPTION 'proposal_not_found_or_forbidden' USING errcode='P0002'; END IF;
  RETURN next_version;
END; $$;

CREATE OR REPLACE FUNCTION public.can_access_tenant_entity(p_entity_type text, p_entity_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE p_entity_type
    WHEN 'grant' THEN EXISTS (SELECT 1 FROM public.grants r WHERE r.id = p_entity_id AND (r.org_id IS NULL OR r.org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())))
    WHEN 'funder' THEN EXISTS (SELECT 1 FROM public.funders r WHERE r.id = p_entity_id AND (r.org_id IS NULL OR r.org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())))
    WHEN 'proposal' THEN EXISTS (SELECT 1 FROM public.proposals r WHERE r.id = p_entity_id AND (r.user_id = auth.uid() OR (r.org_id IS NOT NULL AND r.org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()))))
    WHEN 'submission' THEN EXISTS (SELECT 1 FROM public.submissions r WHERE r.id = p_entity_id AND (r.user_id = auth.uid() OR (r.org_id IS NOT NULL AND r.org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()))))
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, preferred_lang)
  values (new.id, coalesce((new.raw_user_meta_data->>'preferred_lang')::public.app_lang, 'en'))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'member')
  on conflict do nothing;
  return new;
end; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.has_role(_uid, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.log_grant_transition() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.grant_events (grant_id, from_status, to_status, actor_user_id, metadata)
    values (new.id, old.status, new.status, auth.uid(), jsonb_build_object('source', 'trigger'));
  elsif (TG_OP = 'INSERT') then
    insert into public.grant_events (grant_id, from_status, to_status, actor_user_id, metadata)
    values (new.id, null, new.status, auth.uid(), jsonb_build_object('source', 'insert'));
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.match_grant_search_documents(match_threshold double precision DEFAULT 0.35, match_count integer DEFAULT 100) RETURNS TABLE(grant_id uuid, semantic_similarity double precision)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$ SELECT g.id, 0.0::double precision FROM public.grants g WHERE false; $$;

CREATE OR REPLACE FUNCTION public.match_grant_search_documents(query_embedding public.vector, match_threshold double precision DEFAULT 0.35, match_count integer DEFAULT 100) RETURNS TABLE(grant_id uuid, semantic_similarity double precision)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    d.grant_id,
    (1 - (d.embedding OPERATOR(public.<=>) query_embedding))::double precision as semantic_similarity
  from public.grant_search_documents d
  join public.grants g on g.id = d.grant_id
  where d.embedding is not null
    and g.status not in ('archived', 'expired', 'lost')
    and 1 - (d.embedding OPERATOR(public.<=>) query_embedding) >= match_threshold
  order by d.embedding OPERATOR(public.<=>) query_embedding
  limit least(greatest(match_count, 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(query_embedding public.vector, match_user_id uuid, match_count integer DEFAULT 6) RETURNS TABLE(id uuid, content text, source text, language public.app_lang, similarity double precision)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT k.id, k.content, k.source, k.language,
         1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks k
  WHERE k.embedding IS NOT NULL
    AND (
      k.user_id = match_user_id
      OR (
        k.org_id IS NOT NULL
        AND k.org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = match_user_id)
      )
    )
  ORDER BY k.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.normalize_title_v2(t text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  s text;
BEGIN
  IF t IS NULL THEN RETURN ''; END IF;
  s := regexp_replace(t, '\([^)]*\)', ' ', 'g');
  s := lower(s);
  s := translate(s,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy');
  s := regexp_replace(s, '[^a-z0-9]+', ' ', 'g');
  s := trim(s);
  s := array_to_string(
    array(
      SELECT w FROM unnest(string_to_array(s, ' ')) w
      WHERE length(w) > 1
        AND w NOT IN ('program','programme','initiative','fund','funding','grant','grants',
                      'subsidy','subsidies','subvention','subventions','aide','aides',
                      'credit','credits','loan','loans','pret','prets','prêt','prêts',
                      'scholarship','bourse','bourses','the','le','la','les','de','du','des')
    ),
    ' ');
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_crawl_fetch(p_url text, p_host text, p_funder_id uuid, p_outcome_kind text, p_content_hash text, p_via text, p_http_status integer, p_etag text, p_last_modified text, p_bytes integer, p_title text, p_error_reason text, p_default_interval integer) RETURNS TABLE(next_fetch_at timestamp with time zone, status text, changed boolean, interval_hours integer, content_hash text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_row            record;
  v_prev_hash      text;
  v_prev_interval  integer;
  v_change_count   integer;
  v_fetch_count    integer;
  v_error_count    integer;
  v_status         text;
  v_next_interval  integer;
  v_out_hash       text;
  v_changed        boolean := false;
  v_last_error     text := null;
  v_etag           text := null;
  v_last_modified  text := null;
  v_http_status    integer := null;
  v_via            text := null;
  v_bytes          integer := null;
  v_title          text := null;
  v_now            timestamptz := now();
  v_next_fetch_at  timestamptz;
begin
  if p_outcome_kind not in ('ok', 'not_modified', 'gone', 'blocked', 'error') then
    raise exception 'invalid_outcome_kind: %', p_outcome_kind;
  end if;
  perform pg_advisory_xact_lock(hashtext('crawl_ledger:' || p_url));
  select cl.content_hash, cl.interval_hours, cl.change_count, cl.fetch_count, cl.error_count
    into v_row
    from public.crawl_ledger cl
   where cl.url = p_url
   for update;
  v_prev_hash := v_row.content_hash;
  v_prev_interval := coalesce(v_row.interval_hours, p_default_interval);
  v_change_count := coalesce(v_row.change_count, 0);
  v_fetch_count := coalesce(v_row.fetch_count, 0) + 1;
  v_error_count := coalesce(v_row.error_count, 0);
  v_out_hash := v_prev_hash;
  if p_outcome_kind = 'ok' then
    v_via := p_via;
    v_http_status := coalesce(p_http_status, 200);
    v_etag := p_etag;
    v_last_modified := p_last_modified;
    v_bytes := p_bytes;
    v_title := p_title;
    if v_prev_hash is not null and v_prev_hash <> p_content_hash then
      v_status := 'changed';
      v_changed := true;
      v_change_count := v_change_count + 1;
      v_next_interval := least(greatest(floor(v_prev_interval * 0.5)::int, 6), 336);
    elsif v_prev_hash = p_content_hash then
      v_status := 'unchanged';
      v_next_interval := least(greatest(floor(v_prev_interval * 1.5)::int, 24), 336);
    else
      v_status := 'ok';
      v_next_interval := 24;
    end if;
    v_out_hash := p_content_hash;
  elsif p_outcome_kind = 'not_modified' then
    v_via := p_via;
    v_http_status := 304;
    v_etag := p_etag;
    v_last_modified := p_last_modified;
    v_status := 'unchanged';
    v_next_interval := least(greatest(floor(v_prev_interval * 1.5)::int, 24), 336);
  elsif p_outcome_kind = 'gone' then
    v_status := 'gone';
    v_http_status := p_http_status;
    v_next_interval := 720;
  elsif p_outcome_kind = 'blocked' then
    v_status := 'blocked';
    v_last_error := p_error_reason;
    v_next_interval := 168;
  elsif p_outcome_kind = 'error' then
    v_status := 'error';
    v_http_status := p_http_status;
    v_last_error := p_error_reason;
    v_error_count := v_error_count + 1;
    v_next_interval := least(greatest(floor(v_prev_interval * 2)::int, 24), 168);
  end if;
  v_next_fetch_at := v_now + (v_next_interval || ' hours')::interval;
  insert into public.crawl_ledger (
    url, host, funder_id, last_fetched_at, next_fetch_at, interval_hours,
    content_hash, etag, last_modified, change_count, status, http_status,
    fetch_count, error_count, last_error, via, bytes, title
  ) values (
    p_url, p_host, p_funder_id, v_now, v_next_fetch_at, v_next_interval,
    v_out_hash, v_etag, v_last_modified, v_change_count, v_status, v_http_status,
    v_fetch_count, v_error_count, v_last_error, v_via, v_bytes, v_title
  )
  on conflict (url) do update set
    host = excluded.host, funder_id = excluded.funder_id, last_fetched_at = excluded.last_fetched_at,
    next_fetch_at = excluded.next_fetch_at, interval_hours = excluded.interval_hours,
    content_hash = excluded.content_hash, etag = excluded.etag, last_modified = excluded.last_modified,
    change_count = excluded.change_count, status = excluded.status, http_status = excluded.http_status,
    fetch_count = excluded.fetch_count, error_count = excluded.error_count, last_error = excluded.last_error,
    via = excluded.via, bytes = excluded.bytes, title = excluded.title;
  return query
    select v_next_fetch_at, v_status, v_changed, v_next_interval, v_out_hash;
end;
$$;

CREATE TABLE public.grant_search_feedback (
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grant_search_feedback_action_check CHECK ((action = ANY (ARRAY['saved'::text, 'hidden'::text, 'rejected'::text, 'restored'::text, 'pursued'::text]))),
    CONSTRAINT grant_search_feedback_note_check CHECK (((note IS NULL) OR (char_length(note) <= 2000))),
    CONSTRAINT grant_search_feedback_query_text_check CHECK (((query_text IS NULL) OR (char_length(query_text) <= 500))),
    CONSTRAINT grant_search_feedback_rank_position_check CHECK (((rank_position IS NULL) OR (rank_position >= 1))),
    CONSTRAINT grant_search_feedback_reason_check CHECK (((reason IS NULL) OR (reason = ANY (ARRAY['applicant_type'::text, 'jurisdiction'::text, 'sector'::text, 'population'::text, 'funding_use'::text, 'amount'::text, 'deadline'::text, 'capacity'::text, 'duplicate'::text, 'not_a_grant'::text, 'other'::text]))))
);

CREATE OR REPLACE FUNCTION public.record_grant_search_feedback(p_profile_id uuid, p_grant_id uuid, p_action text, p_reason text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_query_text text DEFAULT NULL::text, p_rank_position integer DEFAULT NULL::integer, p_score_snapshot jsonb DEFAULT '{}'::jsonb) RETURNS public.grant_search_feedback
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE v_user_id uuid := auth.uid(); v_row public.grant_search_feedback;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grant_search_profiles WHERE id = p_profile_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'search_profile_not_found';
  END IF;
  INSERT INTO public.grant_search_feedback_events(profile_id, grant_id, user_id, action, reason, note, query_text, rank_position, score_snapshot)
  VALUES (p_profile_id, p_grant_id, v_user_id, p_action, p_reason, p_note, p_query_text, p_rank_position, coalesce(p_score_snapshot, '{}'::jsonb));
  INSERT INTO public.grant_search_feedback(profile_id, grant_id, user_id, action, reason, note, query_text, rank_position, score_snapshot)
  VALUES (p_profile_id, p_grant_id, v_user_id, p_action, p_reason, p_note, p_query_text, p_rank_position, coalesce(p_score_snapshot, '{}'::jsonb))
  ON CONFLICT (profile_id, grant_id, user_id) DO UPDATE SET action=excluded.action, reason=excluded.reason, note=excluded.note, query_text=excluded.query_text, rank_position=excluded.rank_position, score_snapshot=excluded.score_snapshot, updated_at=now()
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_audit_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN RAISE EXCEPTION 'audit_events_are_append_only'; END;
$$;

CREATE OR REPLACE FUNCTION public.search_funder_catalog(search_query text, result_limit integer DEFAULT 500) RETURNS TABLE(funder_id uuid, relevance double precision, matched_on text)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  with scored as (
    select
      f.id as funder_id,
      greatest(
        extensions.word_similarity(lower(trim(search_query)), lower(f.name)),
        extensions.word_similarity(lower(trim(search_query)), lower(coalesce(f.legal_name, ''))) * 0.9
      )::double precision as fuzzy_score,
      (case
        when lower(f.name) = lower(trim(search_query)) then 1.0
        when lower(f.name) like lower(trim(search_query)) || '%' then 0.8
        when public.search_term_matches(f.name, trim(search_query)) then 0.6
        when public.search_term_matches(f.legal_name, trim(search_query)) then 0.5
        when public.search_term_matches(f.jurisdiction, trim(search_query)) then 0.45
        when public.search_term_matches(f.country, trim(search_query)) then 0.4
        when public.search_term_matches(f.category, trim(search_query)) then 0.35
        when public.search_term_matches(f.city, trim(search_query)) then 0.3
        when public.search_term_matches(f.province, trim(search_query)) then 0.3
        else 0.0
      end)::double precision as exact_score,
      (case
        when public.search_term_matches(f.name, trim(search_query)) then 'name'
        when public.search_term_matches(f.legal_name, trim(search_query)) then 'legal_name'
        when public.search_term_matches(f.jurisdiction, trim(search_query)) then 'jurisdiction'
        when public.search_term_matches(f.country, trim(search_query)) then 'country'
        when public.search_term_matches(f.category, trim(search_query)) then 'category'
        when public.search_term_matches(f.city, trim(search_query)) then 'city'
        when public.search_term_matches(f.province, trim(search_query)) then 'province'
        when extensions.word_similarity(lower(trim(search_query)), lower(f.name)) >= 0.3 then 'name (fuzzy)'
        else 'related'
      end) as matched_on
    from public.funders f
    where trim(search_query) <> ''
  )
  select scored.funder_id,
         greatest(scored.exact_score, scored.fuzzy_score) as relevance,
         scored.matched_on
  from scored
  where scored.exact_score > 0 or scored.fuzzy_score >= 0.3
  order by 2 desc
  limit least(greatest(result_limit, 1), 500);
$$;

CREATE OR REPLACE FUNCTION public.search_grant_catalog(search_query text, result_limit integer DEFAULT 100) RETURNS TABLE(grant_id uuid, relevance double precision, matched_on text)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  with input as (
    select
      trim(search_query) as raw_query,
      coalesce(
        nullif(pg_catalog.websearch_to_tsquery('simple', trim(search_query)), ''::tsquery),
        nullif(pg_catalog.plainto_tsquery('simple', trim(search_query)), ''::tsquery)
      ) as parsed_query
  ), scored as (
    select
      g.id as grant_id,
      (
        case
          when lower(g.title) = lower(input.raw_query) then 1.0
          when lower(g.title) like lower(input.raw_query) || '%' then 0.75
          when lower(g.title) like '%' || lower(input.raw_query) || '%' then 0.55
          when lower(coalesce(f.name, '')) like '%' || lower(input.raw_query) || '%' then 0.4
          else 0.0
        end
        +
        case
          when input.parsed_query is not null then
            coalesce(
              pg_catalog.ts_rank_cd(
                setweight(pg_catalog.to_tsvector('simple', coalesce(g.title, '')), 'A') ||
                setweight(pg_catalog.to_tsvector('simple', coalesce(g.title_fr, '')), 'A') ||
                setweight(pg_catalog.to_tsvector('simple', coalesce(g.summary, '')), 'B') ||
                setweight(pg_catalog.to_tsvector('simple', coalesce(g.summary_fr, '')), 'B'),
                input.parsed_query,
                32
              ) * 0.45,
              0.0
            )
          else 0.0
        end
        +
        coalesce(
          greatest(
            extensions.word_similarity(lower(input.raw_query), lower(g.title)),
            extensions.word_similarity(lower(input.raw_query), lower(coalesce(f.name, ''))) * 0.7
          ) * 0.2,
          0.0
        )
        +
        case
          when lower(coalesce(f.jurisdiction, '')) like '%' || lower(input.raw_query) || '%'
            or lower(coalesce(f.country, '')) like '%' || lower(input.raw_query) || '%' then 0.2
          when lower(coalesce(f.category, '')) like '%' || lower(input.raw_query) || '%' then 0.15
          else 0.0
        end
      )::double precision as raw_score,
      (
        case
          when lower(g.title) = lower(input.raw_query) then 'title'
          when lower(g.title) like '%' || lower(input.raw_query) || '%' then 'title'
          when lower(coalesce(f.name, '')) like '%' || lower(input.raw_query) || '%'
            or lower(coalesce(f.legal_name, '')) like '%' || lower(input.raw_query) || '%' then 'funder'
          when input.parsed_query is not null and (
            setweight(pg_catalog.to_tsvector('simple', coalesce(g.title, '')), 'A') ||
            setweight(pg_catalog.to_tsvector('simple', coalesce(g.title_fr, '')), 'A')
          ) @@ input.parsed_query then 'title'
          when input.parsed_query is not null and (
            setweight(pg_catalog.to_tsvector('simple', coalesce(g.summary, '')), 'B') ||
            setweight(pg_catalog.to_tsvector('simple', coalesce(g.summary_fr, '')), 'B')
          ) @@ input.parsed_query then 'summary'
          when extensions.word_similarity(lower(input.raw_query), lower(g.title)) >= 0.35 then 'title (fuzzy)'
          when lower(coalesce(f.jurisdiction, '')) like '%' || lower(input.raw_query) || '%'
            or lower(coalesce(f.country, '')) like '%' || lower(input.raw_query) || '%' then 'funder jurisdiction'
          when lower(coalesce(f.category, '')) like '%' || lower(input.raw_query) || '%' then 'funder category'
          else 'related'
        end
      ) as matched_on,
      g.fit_score
    from public.grants g
    left join public.funders f on f.id = g.funder_id
    cross join input
    where trim(input.raw_query) <> '' and (
      (input.parsed_query is not null and (
        setweight(pg_catalog.to_tsvector('simple', coalesce(g.title, '')), 'A') ||
        setweight(pg_catalog.to_tsvector('simple', coalesce(g.title_fr, '')), 'A') ||
        setweight(pg_catalog.to_tsvector('simple', coalesce(g.summary, '')), 'B') ||
        setweight(pg_catalog.to_tsvector('simple', coalesce(g.summary_fr, '')), 'B')
      ) @@ input.parsed_query)
      or lower(g.title) like '%' || lower(input.raw_query) || '%'
      or lower(coalesce(f.name, '')) like '%' || lower(input.raw_query) || '%'
      or lower(coalesce(f.legal_name, '')) like '%' || lower(input.raw_query) || '%'
      or lower(coalesce(f.jurisdiction, '')) like '%' || lower(input.raw_query) || '%'
      or lower(coalesce(f.country, '')) like '%' || lower(input.raw_query) || '%'
      or lower(coalesce(f.category, '')) like '%' || lower(input.raw_query) || '%'
      or extensions.word_similarity(lower(input.raw_query), lower(g.title)) >= 0.35
      or extensions.word_similarity(lower(input.raw_query), lower(coalesce(f.name, ''))) >= 0.45
    )
  )
  select
    grant_id,
    least(1.0, greatest(0.01, raw_score))::double precision as relevance,
    matched_on
  from scored
  order by relevance desc, fit_score desc nulls last
  limit least(greatest(result_limit, 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.search_term_matches(haystack text, needle text) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $_$
  select case
    when coalesce(haystack, '') = '' or coalesce(needle, '') = '' then false
    when length(needle) <= 4
      then lower(haystack) ~ ('\m' || regexp_replace(lower(needle), '([\.\*\+\?\(\)\[\]\{\}\|\\\^\$])', '\\\1', 'g') || '\M')
    else lower(haystack) like '%' || lower(needle) || '%'
  end;
$_$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin new.updated_at = now(); return new; end; $$;

CREATE OR REPLACE FUNCTION public.validate_grant_transition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  valid boolean := false;
begin
  if TG_OP <> 'UPDATE' then return new; end if;
  if new.status = old.status then return new; end if;
  valid := case old.status
    when 'discovered'  then new.status in ('enriched','scored','archived','expired')
    when 'enriched'    then new.status in ('scored','archived','expired','discovered')
    when 'scored'      then new.status in ('shortlisted','archived','expired','discovered','enriched')
    when 'shortlisted' then new.status in ('in_proposal','archived','expired','discovered')
    when 'in_proposal' then new.status in ('submitted','archived','expired','discovered')
    when 'submitted'   then new.status in ('won','lost','expired','discovered')
    when 'won'         then new.status in ('archived','discovered')
    when 'lost'        then new.status in ('archived','discovered')
    when 'expired'     then new.status in ('archived','discovered','enriched')
    when 'archived'    then new.status in ('discovered','expired')
    else false
  end;
  if not valid then
    raise exception 'invalid grant state transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$$;

CREATE TABLE public.agent_config_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent text NOT NULL,
    user_id uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    field text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    is_prompt boolean DEFAULT false NOT NULL
);

CREATE TABLE public.agent_configs (
    agent text NOT NULL,
    model text DEFAULT 'google/gemini-2.5-flash'::text NOT NULL,
    fallback_model text,
    temperature numeric DEFAULT 0.2 NOT NULL,
    top_p numeric DEFAULT 1.0 NOT NULL,
    max_output_tokens integer DEFAULT 2048 NOT NULL,
    json_mode boolean DEFAULT true NOT NULL,
    system_prompt text,
    prompt_version text DEFAULT '1.0.0'::text NOT NULL,
    timeout_ms integer DEFAULT 60000 NOT NULL,
    max_retries integer DEFAULT 2 NOT NULL,
    concurrency integer DEFAULT 4 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);

CREATE TABLE public.agent_flags (
    agent text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    description_fr text DEFAULT ''::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS run_id text;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS input_tokens integer;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS output_tokens integer;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6);
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS grant_id uuid;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.agent_runs ALTER COLUMN status SET DEFAULT 'running';

CREATE VIEW public.agent_runs_daily WITH (security_invoker='true') AS
 SELECT (date_trunc('day'::text, created_at))::date AS day,
    agent,
    count(*) AS runs,
    count(*) FILTER (WHERE (status = 'succeeded'::text)) AS ok_runs,
    count(*) FILTER (WHERE (status = 'failed'::text)) AS error_runs,
    count(*) FILTER (WHERE (status = 'degraded'::text)) AS degraded_runs,
    COALESCE(sum(input_tokens), (0)::bigint) AS input_tokens,
    COALESCE(sum(output_tokens), (0)::bigint) AS output_tokens,
    (COALESCE(sum(cost_usd), (0)::numeric))::numeric(12,4) AS cost_usd,
    (percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((latency_ms)::double precision)))::integer AS p50_ms,
    (percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY ((latency_ms)::double precision)))::integer AS p95_ms
   FROM public.agent_runs
  WHERE (created_at > (now() - '30 days'::interval))
  GROUP BY ((date_trunc('day'::text, created_at))::date), agent
  ORDER BY ((date_trunc('day'::text, created_at))::date) DESC, agent;

CREATE TABLE public.agent_trace_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id text NOT NULL,
    grant_id uuid,
    agent text NOT NULL,
    step text NOT NULL,
    status text DEFAULT 'info'::text NOT NULL,
    message text,
    payload jsonb,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS question text;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS answer_en text;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS answer_fr text;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS evidence_notes text;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS knowledge_chunk_id uuid;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS use_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;
ALTER TABLE public.answer_library ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE public.approval_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT approval_instances_entity_type_check CHECK ((entity_type = ANY (ARRAY['grant'::text, 'proposal'::text]))),
    CONSTRAINT approval_instances_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.approval_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    name text NOT NULL,
    approver_role text NOT NULL,
    step_order integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_at timestamp with time zone,
    comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_steps_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    entity_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_workflows_entity_type_check CHECK ((entity_type = ANY (ARRAY['grant'::text, 'proposal'::text])))
);

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.audit_trail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    changes jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_trail_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'status_change'::text, 'approval'::text, 'submission'::text])))
);

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    content text NOT NULL,
    author_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.competitive_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_id text NOT NULL,
    recipient_name text NOT NULL,
    recipient_legal_name text,
    recipient_type text,
    recipient_province text,
    recipient_city text,
    program_name text,
    agreement_title text,
    agreement_value numeric,
    agreement_start_date text,
    agreement_end_date text,
    agreement_type text,
    description text,
    naics_code text,
    department text,
    data_source text DEFAULT 'tbs_proactive_disclosure'::text NOT NULL,
    data_year integer DEFAULT 2025 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.compliance_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    due_date date NOT NULL,
    frequency text DEFAULT 'once'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid,
    created_by uuid,
    CONSTRAINT compliance_items_frequency_check CHECK ((frequency = ANY (ARRAY['once'::text, 'quarterly'::text, 'semi_annual'::text, 'annual'::text]))),
    CONSTRAINT compliance_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'overdue'::text]))),
    CONSTRAINT compliance_items_type_check CHECK ((type = ANY (ARRAY['progress_report'::text, 'financial_report'::text, 'final_report'::text, 'audit'::text, 'other'::text])))
);

CREATE TABLE public.compliance_matrices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    overall_score integer NOT NULL,
    mandatory_met integer NOT NULL,
    mandatory_total integer NOT NULL,
    checks jsonb DEFAULT '[]'::jsonb NOT NULL,
    policy_alignment jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.consent_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    consent_type public.consent_type NOT NULL,
    action public.consent_action NOT NULL,
    policy_version text NOT NULL,
    language public.app_lang DEFAULT 'en'::public.app_lang NOT NULL,
    ip_hash text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crawl_ledger (
    url text NOT NULL,
    host text NOT NULL,
    funder_id uuid,
    last_fetched_at timestamp with time zone,
    next_fetch_at timestamp with time zone DEFAULT now() NOT NULL,
    interval_hours integer DEFAULT 24 NOT NULL,
    content_hash text,
    etag text,
    last_modified text,
    change_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    http_status integer,
    fetch_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    last_error text,
    via text,
    bytes integer,
    title text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crawl_ledger_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ok'::text, 'unchanged'::text, 'changed'::text, 'gone'::text, 'blocked'::text, 'error'::text])))
);