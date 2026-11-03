-- Capacity planning settings, one row per workspace.
-- The forecast itself is worked out from ticket history each time, so it needs no table.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists capacity_settings (
  org_id uuid primary key references organizations (id) on delete cascade,
  -- The team's local time zone: ticket times are grouped by its hours, and the roster is in it
  timezone text not null default 'Asia/Kolkata',
  -- Average handling time per contact, in minutes
  aht_minutes numeric(5, 1) not null default 8 check (aht_minutes > 0 and aht_minutes <= 240),
  -- Service level: answer target_percent of contacts within target_seconds
  target_percent integer not null default 80 check (target_percent between 50 and 99),
  target_seconds integer not null default 120 check (target_seconds between 10 and 86400),
  -- Time agents are rostered but not handling contacts (meetings, coaching, absence), on top of breaks
  shrinkage_percent integer not null default 15 check (shrinkage_percent between 0 and 60),
  -- How many past weeks the forecast averages
  history_weeks integer not null default 6 check (history_weeks between 1 and 26),
  -- Use a made-up demand pattern instead of real tickets, for demos and new teams
  use_sample_demand boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table capacity_settings enable row level security;
