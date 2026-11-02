-- Private notes agents leave on a ticket. Customers never see these.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists ticket_notes (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references tickets (id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_notes_ticket_id_idx on ticket_notes (ticket_id, created_at);

-- Same as the other tables: no browser access, the server uses the secret key
alter table ticket_notes enable row level security;
