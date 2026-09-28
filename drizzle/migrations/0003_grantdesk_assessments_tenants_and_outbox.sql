-- ── 0019 condition assessments ──────────────────────────────────────────────
create table if not exists requirement_assessments (
  proposal_id uuid not null references proposals(id) on delete cascade,
  requirement_id uuid not null references requirements(id) on delete cascade,
  assessment text not null,
  model text not null,
  assessed_at timestamptz not null default now(),
  primary key (proposal_id, requirement_id)
);
grant select, insert, update, delete on requirement_assessments to authenticated;
grant all on requirement_assessments to service_role;
alter table requirement_assessments enable row level security;
create policy requirement_assessments_own_all on requirement_assessments
  for all to authenticated
  using (exists (
    select 1 from proposals p
    where p.id = requirement_assessments.proposal_id and public.owns_client(p.client_id)
  ))
  with check (exists (
    select 1 from proposals p
    where p.id = requirement_assessments.proposal_id and public.owns_client(p.client_id)
  ));

-- ── 0020 fabrication concerns ───────────────────────────────────────────────
alter table proposal_sections add column if not exists fabrication_concerns jsonb
  not null default '[]';

-- ── 0021 section revisions ──────────────────────────────────────────────────
create table if not exists proposal_section_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  requirement_id uuid references requirements(id) on delete set null,
  content text not null,
  word_count integer,
  drafted_by text,
  created_at timestamptz not null default now()
);
create index if not exists proposal_section_revisions_lookup_idx
  on proposal_section_revisions (proposal_id, requirement_id, created_at desc);
grant select, insert, update, delete on proposal_section_revisions to authenticated;
grant all on proposal_section_revisions to service_role;
alter table proposal_section_revisions enable row level security;
drop policy if exists proposal_section_revisions_own_all on proposal_section_revisions;
create policy proposal_section_revisions_own_all on proposal_section_revisions
  for all to authenticated
  using (exists (
    select 1 from proposals p
    where p.id = proposal_section_revisions.proposal_id and owns_client(p.client_id)
  ))
  with check (exists (
    select 1 from proposals p
    where p.id = proposal_section_revisions.proposal_id and owns_client(p.client_id)
  ));

-- ── 0022 attachment location ────────────────────────────────────────────────
alter table requirement_acknowledgements add column if not exists location text;

-- ── 0024 atomic match persist ───────────────────────────────────────────────
create or replace function replace_matches(
  target_client uuid,
  match_rows jsonb,
  matched_at timestamptz
)
returns void
language plpgsql
set search_path = public
as $$
declare
  row jsonb;
  check_row jsonb;
  new_match_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(target_client::text));
  delete from matches where client_id = target_client;
  for row in select * from jsonb_array_elements(match_rows) loop
    insert into matches (client_id, grant_id, verdict, relevance, retrieval, matched_at)
    values (
      target_client,
      (row->>'grant_id')::uuid,
      row->>'verdict',
      nullif(row->>'relevance', '')::numeric,
      coalesce(row->'retrieval', '{}'::jsonb),
      matched_at
    )
    returning id into new_match_id;
    for check_row in select * from jsonb_array_elements(coalesce(row->'checks', '[]'::jsonb)) loop
      insert into eligibility_checks (match_id, rule_key, status, is_hard_gate, detail, passed)
      values (
        new_match_id,
        check_row->>'rule_key',
        check_row->>'status',
        (check_row->>'is_hard_gate')::boolean,
        check_row->>'detail',
        check_row->>'status' = 'pass'
      );
    end loop;
  end loop;
end;
$$;
revoke all on function replace_matches(uuid, jsonb, timestamptz) from public;
grant execute on function replace_matches(uuid, jsonb, timestamptz) to authenticated;

-- ── 0025 tenants and subdomains ─────────────────────────────────────────────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subdomain text unique not null,
  branding jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists tenants_slug_idx on tenants (slug);
create index if not exists tenants_subdomain_idx on tenants (subdomain);
grant select on tenants to authenticated, anon;
grant all on tenants to service_role;

create table if not exists tenant_members (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references consultants(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')) default 'member',
  joined_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_members_user_idx on tenant_members (user_id);
grant select on tenant_members to authenticated;
grant all on tenant_members to service_role;

insert into tenants (id, slug, name, subdomain, branding)
values (
  '11111111-1111-1111-1111-111111111111',
  'iial',
  'Institute of Innovation and Advanced Learning',
  'iial',
  '{"tagline": "AI-Native Grant Intelligence", "primary_color": "#0ea5e9", "accent_color": "#0284c7", "logo_url": "/brand/iial-logo.png", "logo_inverse_url": "/brand/iial-logo-inverse.png"}'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  branding = excluded.branding;

alter table clients
  add column if not exists tenant_id uuid references tenants(id) on delete cascade
  default '11111111-1111-1111-1111-111111111111'::uuid;
create index if not exists clients_tenant_idx on clients (tenant_id);
update clients
set tenant_id = '11111111-1111-1111-1111-111111111111'
where tenant_id is null;

alter table tenants enable row level security;
alter table tenant_members enable row level security;
drop policy if exists tenants_public_read on tenants;
create policy tenants_public_read on tenants
  for select using (true);
drop policy if exists tenant_members_read on tenant_members;
create policy tenant_members_read on tenant_members
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.belongs_to_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (target_tenant_id is null) or exists (
    select 1 from tenant_members tm
    where tm.tenant_id = target_tenant_id and tm.user_id = auth.uid()
  );
$$;
grant execute on function public.belongs_to_tenant(uuid) to authenticated;

create or replace function public.get_tenant_id_by_slug(target_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from tenants where lower(slug) = lower(target_slug) limit 1;
$$;
grant execute on function public.get_tenant_id_by_slug(text) to authenticated, anon;

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
      and public.belongs_to_tenant(c.tenant_id)
      and (
        c.consultant_id = auth.uid()
        or exists (
          select 1 from client_team_members m
          where m.client_id = c.id and m.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists clients_select on clients;
create policy clients_select on clients
  for select to authenticated
  using (
    public.belongs_to_tenant(tenant_id)
    and (
      consultant_id = auth.uid()
      or exists (
        select 1 from client_team_members m where m.client_id = id and m.user_id = auth.uid()
      )
    )
  );
drop policy if exists clients_insert on clients;
create policy clients_insert on clients
  for insert to authenticated
  with check (
    consultant_id = auth.uid()
    and public.belongs_to_tenant(tenant_id)
  );
drop policy if exists clients_update on clients;
create policy clients_update on clients
  for update to authenticated
  using (
    public.belongs_to_tenant(tenant_id)
    and (
      consultant_id = auth.uid()
      or exists (
        select 1 from client_team_members m where m.client_id = id and m.user_id = auth.uid()
      )
    )
  )
  with check (
    public.belongs_to_tenant(tenant_id)
    and (
      consultant_id = auth.uid()
      or exists (
        select 1 from client_team_members m where m.client_id = id and m.user_id = auth.uid()
      )
    )
  );

-- Sign-up used to be handled by a trigger on managed auth, which is off-limits
-- here. The app calls this once after sign-in instead; it also puts the new
-- consultant in the default workspace so their clients are visible.
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

  insert into public.tenant_members (tenant_id, user_id, role)
  values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'member')
  on conflict (tenant_id, user_id) do nothing;
end;
$$;
revoke all on function public.ensure_consultant() from public;
grant execute on function public.ensure_consultant() to authenticated;

-- ── 0026 discovery alerts and outbox ────────────────────────────────────────
create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade default '11111111-1111-1111-1111-111111111111'::uuid,
  recipient_email text not null,
  subject text not null,
  body_html text not null,
  kind text not null check (kind in ('new_grant_match', 'deadline_reminder', 'system_alert')),
  grant_id uuid references grants(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  status text not null check (status in ('pending', 'sent', 'failed')) default 'pending',
  error text,
  sent_at timestamptz,
  created_date date not null default current_date,
  created_at timestamptz not null default now()
);
create unique index if not exists email_outbox_daily_dedup_idx on email_outbox (
  recipient_email,
  kind,
  coalesce(grant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
  created_date
);
create index if not exists email_outbox_pending_idx on email_outbox (status) where status = 'pending';
create index if not exists email_outbox_tenant_idx on email_outbox (tenant_id);
grant select on email_outbox to authenticated;
grant all on email_outbox to service_role;
alter table email_outbox enable row level security;
drop policy if exists email_outbox_read on email_outbox;
create policy email_outbox_read on email_outbox
  for select to authenticated
  using (public.belongs_to_tenant(tenant_id));