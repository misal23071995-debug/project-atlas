-- File attachments on tickets: screenshots and documents from agents and from customers' emails.
-- Files live in a private Storage bucket; only the server can read or write them, and agents
-- download through short-lived links after their workspace is checked.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- Private bucket, 10 MB per file, common document and image types only (no SVG or HTML, which can carry scripts)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword', 'application/vnd.ms-excel',
    'video/mp4', 'video/quicktime'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists ticket_attachments (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  ticket_id bigint not null references tickets (id) on delete cascade,
  -- The message it came with, if any
  message_id bigint references ticket_messages (id) on delete set null,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  -- Where it is in the bucket: <org>/<ticket>/<random>-<name>
  storage_path text not null unique,
  -- agent (uploaded on the ticket) or customer (came with their email)
  source text not null check (source in ('agent', 'customer')),
  uploaded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_attachments_ticket_idx on ticket_attachments (ticket_id, created_at);

alter table ticket_attachments enable row level security;
