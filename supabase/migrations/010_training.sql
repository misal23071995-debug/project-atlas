-- Training: courses with a lesson and a quiz, and who has been assigned which course.
-- A course can be linked to a quality (QC) criterion, so a low score on it assigns the course.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists courses (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  description text not null default '',
  -- The lesson itself, plain text
  body text not null default '',
  -- [{ "id": "q1", "question": "...", "options": ["a","b","c","d"], "answer": 2, "explanation": "..." }]
  questions jsonb not null default '[]',
  pass_percent integer not null default 80 check (pass_percent between 1 and 100),
  -- A QC scorecard criterion id, e.g. "empathy"
  linked_criterion text,
  published boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_org_idx on courses (org_id);

create table if not exists course_assignments (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  course_id bigint not null references courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Who assigned it, or "Quality check" when a low QC score did
  assigned_by text,
  reason text,
  due_date date,
  status text not null default 'assigned' check (status in ('assigned', 'passed', 'failed')),
  attempts integer not null default 0,
  last_score integer check (last_score between 0 and 100),
  best_score integer check (best_score between 0 and 100),
  passed_at timestamptz,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create index if not exists course_assignments_org_idx on course_assignments (org_id, user_id);

-- No browser access; the Next.js server uses the secret key and filters by org_id itself
alter table courses enable row level security;
alter table course_assignments enable row level security;
