-- Automation: "when X happens and the ticket matches, do Y" rules, plus automatic assignment.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists automation_rules (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  -- ticket_created, customer_replied, sla_breached, waiting_on_customer
  trigger text not null check (trigger in ('ticket_created', 'customer_replied', 'sla_breached', 'waiting_on_customer')),
  -- For waiting_on_customer: how long the ticket has waited, in hours
  wait_hours integer check (wait_hours between 1 and 2160),
  -- [{ "field": "category", "op": "is", "value": "Returns & Refunds" }], all must match
  conditions jsonb not null default '[]',
  -- [{ "type": "set_priority", "value": "High" }, { "type": "add_tag", "value": "Refund" }]
  actions jsonb not null default '[]',
  -- Rules run in this order, lowest first
  position integer not null default 0,
  run_count integer not null default 0,
  last_run_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_org_idx on automation_rules (org_id, trigger, position);

-- Time-based rules act on a ticket once, so record each time a rule fired on a ticket
create table if not exists automation_runs (
  rule_id bigint not null references automation_rules (id) on delete cascade,
  ticket_id bigint not null references tickets (id) on delete cascade,
  ran_at timestamptz not null default now(),
  primary key (rule_id, ticket_id)
);

-- How new tickets get an owner
create table if not exists assignment_settings (
  org_id uuid primary key references organizations (id) on delete cascade,
  -- off, round_robin (take turns) or least_busy (fewest open tickets)
  mode text not null default 'off' check (mode in ('off', 'round_robin', 'least_busy')),
  -- Only people with a shift on the roster right now
  only_on_shift boolean not null default false,
  -- Who can receive tickets; empty means everyone who works tickets
  user_ids uuid[] not null default '{}',
  -- Round robin: who got the last one
  last_assigned_user_id uuid,
  -- When the time-based rules last ran, so page loads don't run them more than every few minutes
  last_sweep_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table automation_rules enable row level security;
alter table automation_runs enable row level security;
alter table assignment_settings enable row level security;
