-- ── 0005 matching ───────────────────────────────────────────────────────────
alter table grants add column if not exists eligible_applicant_types text[] not null default '{}';
alter table grants add column if not exists eligibility_note text;

create or replace function grant_text_config(lang text) returns regconfig
language sql immutable parallel safe as $$
  select case lower(coalesce(lang, 'en'))
    when 'fr' then 'french'::regconfig
    when 'es' then 'spanish'::regconfig
    when 'pt' then 'portuguese'::regconfig
    else 'english'::regconfig
  end;
$$;

-- The original index stemmed every grant with the 'simple' dictionary, which
-- made a French call reachable only by its exact wording. This column stems in
-- the grant's own language instead; the first one stays in place, unused.
alter table grants
  add column if not exists search_tsv_ml tsvector
  generated always as (
    setweight(to_tsvector(grant_text_config(language), coalesce(title, '')), 'A') ||
    setweight(to_tsvector(grant_text_config(language), coalesce(summary, '')), 'B') ||
    setweight(to_tsvector(grant_text_config(language), coalesce(eligibility_note, '')), 'D')
  ) stored;
comment on column public.grants.search_tsv is 'DEPRECATED: replaced by search_tsv_ml, which stems in the grant''s own language.';
drop index if exists grants_search_tsv_idx;
create index if not exists grants_search_tsv_ml_idx on grants using gin (search_tsv_ml);

create index if not exists grant_embeddings_hnsw_idx
  on grant_embeddings using hnsw (embedding vector_cosine_ops);

create or replace function search_grants(
  q text,
  q_embedding vector(768),
  q_language text default 'en',
  countries text[] default null,
  pool integer default 200,
  result_limit integer default 60
)
returns table (
  grant_id uuid,
  lexical_rank integer,
  vector_rank integer,
  score numeric
)
language sql stable parallel safe as $$
  with parsed as (
    select case
      when q is null or btrim(q) = '' then null
      else websearch_to_tsquery(grant_text_config(q_language), q)
    end as tsq
  ),
  candidates as (
    select g.id, g.search_tsv_ml as search_tsv
    from grants g
    where g.status = 'open'
      and (countries is null or g.country = any (countries))
  ),
  lexical as (
    select c.id,
           row_number() over (order by ts_rank_cd(c.search_tsv, p.tsq) desc, c.id) as rank
    from candidates c, parsed p
    where p.tsq is not null and c.search_tsv @@ p.tsq
    limit pool
  ),
  semantic as (
    select c.id,
           row_number() over (order by e.embedding <=> q_embedding, c.id) as rank
    from candidates c
    join grant_embeddings e on e.grant_id = c.id
    where q_embedding is not null
    limit pool
  )
  select coalesce(l.id, s.id) as grant_id,
         l.rank::integer as lexical_rank,
         s.rank::integer as vector_rank,
         (coalesce(1.0 / (60 + l.rank), 0) + coalesce(1.0 / (60 + s.rank), 0))::numeric as score
  from lexical l
  full outer join semantic s on s.id = l.id
  order by score desc, grant_id
  limit result_limit;
$$;

-- A rule can fail to decide: the funder never said. 'unknown' is a real
-- outcome, kept distinct from 'fail' rather than folded into it.
alter table eligibility_checks add column if not exists status text
  check (status in ('pass', 'fail', 'unknown'));
update eligibility_checks set status = case when passed then 'pass' else 'fail' end
  where status is null;
alter table eligibility_checks alter column status set not null;

alter table matches add column if not exists retrieval jsonb not null default '{}'::jsonb;
alter table matches add column if not exists matched_at timestamptz not null default now();
create index if not exists matches_client_score_idx
  on matches (client_id, relevance desc nulls last);

-- ── 0006 matching grants ────────────────────────────────────────────────────
drop policy if exists eligibility_checks_own_write on eligibility_checks;
create policy eligibility_checks_own_write on eligibility_checks
  for insert to authenticated
  with check (exists (
    select 1 from matches m
    where m.id = eligibility_checks.match_id and public.owns_client(m.client_id)
  ));

drop policy if exists eligibility_checks_own_delete on eligibility_checks;
create policy eligibility_checks_own_delete on eligibility_checks
  for delete to authenticated
  using (exists (
    select 1 from matches m
    where m.id = eligibility_checks.match_id and public.owns_client(m.client_id)
  ));

grant execute on function public.search_grants(text, vector, text, text[], integer, integer)
  to authenticated;
grant execute on function public.grant_text_config(text) to authenticated;

-- ── 0007 drafting ───────────────────────────────────────────────────────────
alter table requirements add column if not exists kind text not null default 'section'
  check (kind in ('section', 'eligibility', 'attachment', 'criterion'));
alter table requirements add column if not exists word_limit integer;
alter table requirements add column if not exists evaluation_note text;
alter table requirements add column if not exists source_quote text;
alter table requirements add column if not exists extracted_at timestamptz;
alter table requirements add column if not exists extracted_from text;
create unique index if not exists requirements_grant_label_idx
  on requirements (grant_id, lower(label));

alter table proposal_sections add column if not exists reused_answer_ids uuid[]
  not null default '{}';
alter table proposal_sections add column if not exists drafted_by text;
alter table proposal_sections add column if not exists word_count integer;

alter table answer_library add column if not exists embedding vector(768);
alter table answer_library add column if not exists content_hash text;
alter table answer_library add column if not exists last_used_at timestamptz;
create index if not exists answer_library_embedding_idx
  on answer_library using hnsw (embedding vector_cosine_ops);

create or replace function match_answers(
  target_client uuid,
  q_embedding vector(768),
  max_results integer default 3,
  min_similarity numeric default 0.55
)
returns table (id uuid, label text, content text, similarity numeric)
language sql stable parallel safe as $$
  select a.id,
         a.label,
         a.content,
         (1 - (a.embedding <=> q_embedding))::numeric as similarity
  from answer_library a
  where a.client_id = target_client
    and a.embedding is not null
    and (1 - (a.embedding <=> q_embedding)) >= min_similarity
  order by a.embedding <=> q_embedding
  limit max_results;
$$;
grant execute on function public.match_answers(uuid, vector, integer, numeric) to authenticated;

drop policy if exists requirements_read on requirements;
create policy requirements_read on requirements for select to authenticated using (true);
drop policy if exists requirements_write on requirements;
create policy requirements_write on requirements for insert to authenticated with check (true);
drop policy if exists requirements_update on requirements;
create policy requirements_update on requirements for update to authenticated using (true);

grant insert, update, delete on requirements to authenticated;