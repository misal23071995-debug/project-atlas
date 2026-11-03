-- Workspaces: each company gets its own private space, and each person has a role in it.
-- Existing data moves into an "Atlas Ring" workspace, and every existing login becomes its admin.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Used in the public chat link: /support/<slug>
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  created_at timestamptz not null default now()
);

-- admin: everything, including the team and workspace settings
-- lead: works tickets and edits the knowledge base
-- agent: works tickets
-- qa: reads tickets and leaves internal notes (quality checks come later)
create table if not exists memberships (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'agent' check (role in ('admin', 'lead', 'agent', 'qa')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists memberships_user_idx on memberships (user_id);

insert into organizations (name, slug)
values ('Atlas Ring', 'atlas-ring')
on conflict (slug) do nothing;

-- Every company-owned table gets an org_id. Rows that exist today belong to Atlas Ring.
do $$
declare
  atlas uuid := (select id from organizations where slug = 'atlas-ring');
  t text;
begin
  foreach t in array array['customers', 'tickets', 'kb_articles', 'bot_conversations'] loop
    execute format('alter table %I add column if not exists org_id uuid references organizations (id) on delete cascade', t);
    execute format('update %I set org_id = $1 where org_id is null', t) using atlas;
    execute format('alter table %I alter column org_id set not null', t);
    execute format('create index if not exists %I on %I (org_id)', t || '_org_idx', t);
  end loop;
end $$;

-- The same customer email can exist once per company, not once in the whole system
alter table customers drop constraint if exists customers_email_key;
create unique index if not exists customers_org_email_idx on customers (org_id, email);

-- Everyone who can sign in today becomes an admin of Atlas Ring
insert into memberships (org_id, user_id, role)
select o.id, u.id, 'admin'
from auth.users u
cross join organizations o
where o.slug = 'atlas-ring'
on conflict do nothing;

-- No browser access; the Next.js server uses the secret key and filters by org_id itself
alter table organizations enable row level security;
alter table memberships enable row level security;
