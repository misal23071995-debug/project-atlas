-- SLA tracking: when each ticket got its first reply and was resolved, and when both were due.
-- Targets are set per priority in each workspace; tickets keep the due times they were given.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists sla_targets (
  org_id uuid not null references organizations (id) on delete cascade,
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  first_response_minutes integer not null check (first_response_minutes between 1 and 43200),
  resolution_minutes integer not null check (resolution_minutes between 1 and 129600),
  updated_at timestamptz not null default now(),
  primary key (org_id, priority)
);

alter table sla_targets enable row level security;

alter table tickets add column if not exists first_response_at timestamptz;
alter table tickets add column if not exists resolved_at timestamptz;
alter table tickets add column if not exists first_response_due_at timestamptz;
alter table tickets add column if not exists resolution_due_at timestamptz;
-- The resolution clock stops while a ticket is Waiting on Customer
alter table tickets add column if not exists sla_paused_at timestamptz;
alter table tickets add column if not exists sla_paused_minutes integer not null default 0;

create index if not exists tickets_org_status_idx on tickets (org_id, status);

-- Existing tickets: the first agent reply is the first response
update tickets t
set first_response_at = m.first_reply
from (
  select ticket_id, min(created_at) as first_reply
  from ticket_messages
  where role = 'agent'
  group by ticket_id
) m
where m.ticket_id = t.id and t.first_response_at is null;

-- Resolved or closed tickets: when the status last changed, or failing that, when the ticket last changed
update tickets t
set resolved_at = coalesce(
  (
    select max(a.created_at)
    from ticket_activities a
    where a.ticket_id = t.id
      and (a.title like 'Status changed to Resolved%' or a.title like 'Status changed to Closed%')
  ),
  t.updated_at
)
where t.status in ('Resolved', 'Closed') and t.resolved_at is null;

-- Due times from the default targets (the same ones the app uses until a workspace sets its own)
update tickets
set
  first_response_due_at = created_at + case priority
    when 'Urgent' then interval '15 minutes'
    when 'High' then interval '1 hour'
    when 'Medium' then interval '4 hours'
    else interval '8 hours'
  end,
  resolution_due_at = created_at + case priority
    when 'Urgent' then interval '4 hours'
    when 'High' then interval '8 hours'
    when 'Medium' then interval '24 hours'
    else interval '72 hours'
  end
where first_response_due_at is null;

-- Tickets waiting on the customer right now start paused
update tickets
set sla_paused_at = now()
where status = 'Waiting on Customer' and sla_paused_at is null;
