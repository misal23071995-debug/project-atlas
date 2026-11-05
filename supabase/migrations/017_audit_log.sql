-- Audit log: who changed what in a workspace (team, roles, settings, rules, orders, sign-in security).
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  -- The person who did it; kept as text too, so the entry survives if they leave
  actor_id uuid,
  actor_name text not null,
  -- e.g. member.role_changed, automation.rule_saved
  action text not null,
  -- What it was done to, in words: "Priya Sharma", "Rule: Payment problems are urgent"
  target text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_time_idx on audit_log (org_id, created_at desc);

alter table audit_log enable row level security;
