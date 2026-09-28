-- ── 0008 section uniqueness ─────────────────────────────────────────────────
create unique index if not exists proposal_sections_requirement_idx
  on proposal_sections (proposal_id, requirement_id);
drop index if exists requirements_grant_label_idx;
create unique index if not exists requirements_grant_label_idx
  on requirements (grant_id, label);

-- ── 0009 submissions ────────────────────────────────────────────────────────
alter table grants add column if not exists assistance_listings text[] not null default '{}';
create index if not exists grants_assistance_listings_idx
  on grants using gin (assistance_listings);
alter table past_awards add column if not exists assistance_listing text;
alter table past_awards add column if not exists recipient_location text;
create index if not exists past_awards_listing_idx on past_awards (assistance_listing);

create table if not exists requirement_acknowledgements (
  proposal_id uuid not null references proposals(id) on delete cascade,
  requirement_id uuid not null references requirements(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  acknowledged_by uuid not null references consultants(id),
  primary key (proposal_id, requirement_id)
);
grant select, insert, update, delete on requirement_acknowledgements to authenticated;
grant all on requirement_acknowledgements to service_role;
alter table requirement_acknowledgements enable row level security;
create policy requirement_ack_own_all on requirement_acknowledgements
  for all to authenticated
  using (exists (
    select 1 from proposals p
    where p.id = requirement_acknowledgements.proposal_id and public.owns_client(p.client_id)
  ))
  with check (exists (
    select 1 from proposals p
    where p.id = requirement_acknowledgements.proposal_id and public.owns_client(p.client_id)
  ));

create unique index if not exists submissions_proposal_idx on submissions (proposal_id);
alter table submissions add column if not exists overridden_blockers jsonb
  not null default '[]'::jsonb;
alter table submissions add column if not exists notes text;
alter table submissions drop constraint if exists submissions_outcome_check;
alter table submissions add constraint submissions_outcome_check
  check (outcome is null or outcome in ('awaiting', 'awarded', 'declined', 'withdrawn'));
alter table submissions alter column outcome set default 'awaiting';

-- ── 0010 columns the app no longer writes ───────────────────────────────────
-- Left in place rather than dropped, so a deployed build that still reads them
-- keeps working. Defaults let inserts omit them.
alter table matches alter column decided_at set default now();
alter table eligibility_checks alter column passed set default false;
alter table proposals alter column status set default 'draft';
comment on column public.matches.decided_at is 'DEPRECATED: replaced by matched_at.';
comment on column public.eligibility_checks.passed is 'DEPRECATED: replaced by status, which also records ''unknown''.';
comment on column public.proposals.status is 'DEPRECATED: proposal state is derived from its sections and submission.';

-- ── 0011 past award cache ───────────────────────────────────────────────────
alter table past_awards add column if not exists fetched_at timestamptz not null default now();
create index if not exists past_awards_fresh_idx on past_awards (assistance_listing, fetched_at desc);

-- ── 0012 answer use counter ─────────────────────────────────────────────────
create or replace function record_answer_use(answer_ids uuid[])
returns void
language sql security invoker as $$
  update answer_library
     set times_used = times_used + 1,
         last_used_at = now()
   where id = any (answer_ids);
$$;
grant execute on function public.record_answer_use(uuid[]) to authenticated;

-- ── 0013 safe requirement replace ───────────────────────────────────────────
create or replace function replace_extracted_requirements(target_grant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  with deleted as (
    delete from requirements r
     where r.grant_id = target_grant
       and r.extracted_from is not null
       and not exists (
         select 1 from proposal_sections ps where ps.requirement_id = r.id
       )
    returning 1
  )
  select count(*) into removed from deleted;
  return removed;
end;
$$;
grant execute on function public.replace_extracted_requirements(uuid) to authenticated;

-- ── 0016 lead time ──────────────────────────────────────────────────────────
alter table client_profiles add column if not exists lead_time_weeks integer
  check (lead_time_weeks is null or (lead_time_weeks >= 0 and lead_time_weeks <= 52));
comment on column client_profiles.lead_time_weeks is
  'Working weeks this client needs to produce a credible application. Feeds the runway rule.';

-- ── 0017 client team ────────────────────────────────────────────────────────
create table if not exists client_team_members (
  client_id uuid not null references clients(id) on delete cascade,
  user_id uuid not null references consultants(id) on delete cascade,
  added_by uuid not null references consultants(id),
  added_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index if not exists client_team_members_user_idx on client_team_members (user_id);
grant select, insert, delete on client_team_members to authenticated;
grant all on client_team_members to service_role;

-- Ownership is set once, at creation. Without this an update could hand a
-- client to another consultant and take it out of the owner's own reach.
create or replace function public.pin_client_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.consultant_id := old.consultant_id;
  return new;
end;
$$;
drop trigger if exists pin_client_ownership on clients;
create trigger pin_client_ownership
  before update on clients
  for each row execute function public.pin_client_ownership();

create or replace function public.owns_client(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from clients c
    where c.id = target
      and (
        c.consultant_id = auth.uid()
        or exists (
          select 1 from client_team_members m
          where m.client_id = c.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.find_consultant_by_email(target_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from consultants where lower(email) = lower(target_email) limit 1;
$$;
grant execute on function public.find_consultant_by_email(text) to authenticated;

drop policy if exists clients_own_all on clients;
create policy clients_insert on clients
  for insert to authenticated
  with check (consultant_id = auth.uid());
create policy clients_select on clients
  for select to authenticated
  using (
    consultant_id = auth.uid()
    or exists (
      select 1 from client_team_members m where m.client_id = id and m.user_id = auth.uid()
    )
  );
create policy clients_update on clients
  for update to authenticated
  using (
    consultant_id = auth.uid()
    or exists (
      select 1 from client_team_members m where m.client_id = id and m.user_id = auth.uid()
    )
  )
  with check (
    consultant_id = auth.uid()
    or exists (
      select 1 from client_team_members m where m.client_id = id and m.user_id = auth.uid()
    )
  );
create policy clients_delete on clients
  for delete to authenticated
  using (consultant_id = auth.uid());

alter table client_team_members enable row level security;
create policy client_team_members_read on client_team_members
  for select to authenticated
  using (public.owns_client(client_id));
create policy client_team_members_owner_insert on client_team_members
  for insert to authenticated
  with check (
    exists (select 1 from clients c where c.id = client_id and c.consultant_id = auth.uid())
  );
create policy client_team_members_delete on client_team_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from clients c where c.id = client_id and c.consultant_id = auth.uid())
  );

-- ── 0018 process requirement kind ───────────────────────────────────────────
alter table requirements drop constraint if exists requirements_kind_check;
alter table requirements
  add constraint requirements_kind_check
  check (kind in ('section', 'eligibility', 'attachment', 'criterion', 'process'));