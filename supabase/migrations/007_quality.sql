-- Quality checks (QC): a scorecard per workspace, and one review per ticket.
-- AI scores the conversation first; a QA analyst or lead checks it, adjusts and finalises it.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists qa_scorecards (
  org_id uuid primary key references organizations (id) on delete cascade,
  -- [{ "id": "accuracy", "label": "...", "description": "...", "weight": 30 }, ...]
  criteria jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists qa_reviews (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  ticket_id bigint not null references tickets (id) on delete cascade,
  -- The agent being scored, by display name (same as tickets.assigned_to)
  agent_name text not null,
  -- pending: AI has scored it, waiting for a person; reviewed: a person finalised it
  status text not null default 'pending' check (status in ('pending', 'reviewed')),

  -- What the AI said, kept so you can compare it with the final human score
  -- [{ "id": "accuracy", "label": "...", "weight": 30, "score": 4, "reason": "..." }, ...]
  ai_scores jsonb,
  ai_total integer check (ai_total between 0 and 100),
  ai_summary text,

  -- The final scores after a person checked them (same shape, without reason)
  scores jsonb,
  total integer check (total between 0 and 100),
  feedback text,
  reviewed_by text,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, ticket_id)
);

create index if not exists qa_reviews_org_created_idx on qa_reviews (org_id, created_at desc);

-- No browser access; the Next.js server uses the secret key and filters by org_id itself
alter table qa_scorecards enable row level security;
alter table qa_reviews enable row level security;
