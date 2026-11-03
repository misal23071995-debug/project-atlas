-- Rostering: one shift per person per day, and leave requests.
-- Times are minutes from midnight in the team's local time. A shift that ends after
-- midnight has end_minute above 1440 (e.g. 22:00-06:00 is 1320-1800).
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists shifts (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  shift_date date not null,
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute > start_minute and end_minute <= start_minute + 1440),
  -- [{ "start": 780, "minutes": 30 }, ...] in the same minutes as the shift
  breaks jsonb not null default '[]',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, shift_date)
);

create index if not exists shifts_org_date_idx on shifts (org_id, shift_date);

create table if not exists leave_requests (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  leave_type text not null default 'annual' check (leave_type in ('annual', 'sick', 'unpaid', 'other')),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  note text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists leave_org_dates_idx on leave_requests (org_id, start_date, end_date);

-- No browser access; the Next.js server uses the secret key and filters by org_id itself
alter table shifts enable row level security;
alter table leave_requests enable row level security;
