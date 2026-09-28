create extension if not exists vector with schema public;

-- ── 0001 core schema ────────────────────────────────────────────────────────
create table if not exists consultants (
  id uuid primary key,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references consultants(id) on delete cascade,
  name text not null,
  website text,
  country text not null default 'CA',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_consultant_idx on clients (consultant_id) where archived_at is null;

create table if not exists client_profiles (
  client_id uuid primary key references clients(id) on delete cascade,
  sectors text[] not null default '{}',
  jurisdictions text[] not null default '{}',
  stage text,
  annual_budget numeric,
  currency text not null default 'CAD',
  capabilities text,
  beneficiaries text,
  extracted_from jsonb not null default '[]',
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists funders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  jurisdiction text,
  category text,
  website text,
  source_key text,
  created_at timestamptz not null default now(),
  unique (name, country)
);

create table if not exists grants (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references funders(id) on delete cascade,
  title text not null,
  summary text,
  url text not null,
  country text not null,
  currency text,
  amount_min numeric,
  amount_max numeric,
  deadline date,
  language text not null default 'en',
  source_key text not null,
  source_hash text not null unique,
  status text not null default 'open',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists grants_funder_idx on grants (funder_id);
create index if not exists grants_deadline_idx on grants (deadline) where status = 'open';

alter table grants
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
  ) stored;
create index if not exists grants_search_tsv_idx on grants using gin (search_tsv);

create table if not exists grant_embeddings (
  grant_id uuid primary key references grants(id) on delete cascade,
  embedding vector(768) not null,
  content_hash text not null,
  model text not null,
  updated_at timestamptz not null default now()
);

create table if not exists past_awards (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid references funders(id) on delete set null,
  grant_id uuid references grants(id) on delete set null,
  recipient_name text not null,
  amount numeric,
  awarded_on date,
  source_key text not null,
  source_hash text not null unique
);
create index if not exists past_awards_grant_idx on past_awards (grant_id);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  grant_id uuid not null references grants(id) on delete cascade,
  verdict text not null check (verdict in ('eligible', 'ineligible', 'needs_input')),
  relevance numeric,
  decided_at timestamptz not null default now(),
  unique (client_id, grant_id)
);
create index if not exists matches_client_verdict_idx on matches (client_id, verdict);

create table if not exists eligibility_checks (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  rule_key text not null,
  passed boolean not null,
  is_hard_gate boolean not null default false,
  detail text not null
);
create index if not exists eligibility_checks_match_idx on eligibility_checks (match_id);

create table if not exists requirements (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references grants(id) on delete cascade,
  label text not null,
  detail text,
  is_critical boolean not null default false,
  sort_order integer not null default 0
);
create index if not exists requirements_grant_idx on requirements (grant_id);

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  grant_id uuid not null references grants(id) on delete cascade,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, grant_id)
);

create table if not exists proposal_sections (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  requirement_id uuid references requirements(id) on delete set null,
  heading text not null,
  content text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists proposal_sections_proposal_idx on proposal_sections (proposal_id);

create table if not exists answer_library (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  content text not null,
  times_used integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists answer_library_client_idx on answer_library (client_id);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  method text,
  confirmation_number text,
  human_reviewed_by uuid not null references consultants(id),
  outcome text
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  agent text not null,
  status text not null,
  provider text,
  model text,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_recent_idx on agent_runs (created_at desc);

-- ── Data API grants ─────────────────────────────────────────────────────────
grant select, insert, update, delete on
  consultants, clients, client_profiles, matches, eligibility_checks,
  proposals, proposal_sections, answer_library, submissions, agent_runs
  to authenticated;
grant select on funders, grants, grant_embeddings, past_awards, requirements to authenticated;
grant all on
  consultants, clients, client_profiles, matches, eligibility_checks,
  proposals, proposal_sections, answer_library, submissions, agent_runs,
  funders, grants, grant_embeddings, past_awards, requirements
  to service_role;

-- ── 0002 row-level security ─────────────────────────────────────────────────
alter table consultants          enable row level security;
alter table clients              enable row level security;
alter table client_profiles      enable row level security;
alter table matches              enable row level security;
alter table eligibility_checks   enable row level security;
alter table proposals            enable row level security;
alter table proposal_sections    enable row level security;
alter table answer_library       enable row level security;
alter table submissions          enable row level security;
alter table agent_runs           enable row level security;
alter table funders              enable row level security;
alter table grants               enable row level security;
alter table grant_embeddings     enable row level security;
alter table past_awards          enable row level security;
alter table requirements         enable row level security;

create or replace function public.owns_client(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from clients c
    where c.id = target and c.consultant_id = auth.uid()
  );
$$;
grant execute on function public.owns_client(uuid) to authenticated;

create policy consultants_self_read on consultants
  for select to authenticated using (id = auth.uid());
create policy consultants_self_write on consultants
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy clients_own_all on clients
  for all to authenticated
  using (consultant_id = auth.uid())
  with check (consultant_id = auth.uid());

create policy client_profiles_own_all on client_profiles
  for all to authenticated
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

create policy funders_read on funders for select to authenticated using (true);
create policy grants_read on grants for select to authenticated using (true);
create policy grant_embeddings_read on grant_embeddings for select to authenticated using (true);
create policy past_awards_read on past_awards for select to authenticated using (true);
create policy requirements_read on requirements for select to authenticated using (true);

create policy matches_own_all on matches
  for all to authenticated
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

create policy eligibility_checks_own_read on eligibility_checks
  for select to authenticated
  using (exists (
    select 1 from matches m
    where m.id = eligibility_checks.match_id and public.owns_client(m.client_id)
  ));

create policy proposals_own_all on proposals
  for all to authenticated
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

create policy proposal_sections_own_all on proposal_sections
  for all to authenticated
  using (exists (
    select 1 from proposals p
    where p.id = proposal_sections.proposal_id and public.owns_client(p.client_id)
  ))
  with check (exists (
    select 1 from proposals p
    where p.id = proposal_sections.proposal_id and public.owns_client(p.client_id)
  ));

create policy answer_library_own_all on answer_library
  for all to authenticated
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

create policy submissions_own_all on submissions
  for all to authenticated
  using (exists (
    select 1 from proposals p
    where p.id = submissions.proposal_id and public.owns_client(p.client_id)
  ))
  with check (exists (
    select 1 from proposals p
    where p.id = submissions.proposal_id and public.owns_client(p.client_id)
  ));

create policy agent_runs_own_read on agent_runs
  for select to authenticated
  using (client_id is null or public.owns_client(client_id));

create policy agent_runs_own_write on agent_runs
  for insert to authenticated
  with check (client_id is null or public.owns_client(client_id));

-- A signed-in consultant gets their own row on demand. The upstream project
-- did this with a trigger on auth.users; managed auth is off-limits here, so
-- the app calls this once after sign-in instead. Identity comes from the JWT,
-- never from the caller's arguments.
create or replace function public.ensure_consultant()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.consultants (id, email, display_name)
  values (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', ''),
    coalesce(
      auth.jwt() -> 'user_metadata' ->> 'display_name',
      auth.jwt() ->> 'email'
    )
  )
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.ensure_consultant() from public;
grant execute on function public.ensure_consultant() to authenticated;

-- ── 0003 profile currency nullable ──────────────────────────────────────────
alter table client_profiles alter column currency drop not null;
alter table client_profiles alter column currency drop default;

-- ── 0004 source runs ────────────────────────────────────────────────────────
create table if not exists source_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'failed')),
  funders_upserted integer not null default 0,
  grants_upserted integer not null default 0,
  error text
);
create index if not exists source_runs_recent_idx on source_runs (source_key, started_at desc);
grant select on source_runs to authenticated;
grant all on source_runs to service_role;
alter table source_runs enable row level security;
create policy source_runs_read on source_runs for select to authenticated using (true);

create or replace view source_freshness as
select
  source_key,
  max(finished_at) filter (where status = 'ok') as last_ok_at,
  count(*) filter (where status = 'failed' and started_at > now() - interval '7 days') as failures_7d
from source_runs
group by source_key;
grant select on source_freshness to authenticated, service_role;