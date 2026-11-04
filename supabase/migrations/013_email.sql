-- Email channel: incoming emails become tickets (or replies on existing ones), and agent replies go out by email.
-- Each workspace gets a private webhook key for its email provider to post incoming mail to.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists email_settings (
  org_id uuid primary key references organizations (id) on delete cascade,
  -- The secret part of the workspace's incoming-mail webhook address
  inbound_key uuid not null unique default gen_random_uuid(),
  -- Shown as the sender name on outgoing mail, e.g. "Atlas Ring Support"
  from_name text,
  signature text not null default '',
  -- Email the customer a "we got your message" reply with the ticket number
  auto_acknowledge boolean not null default true,
  -- Email the satisfaction survey link when an email ticket is resolved
  survey_on_resolve boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table email_settings enable row level security;

-- Every workspace gets settings (and so a webhook key) straight away
insert into email_settings (org_id)
select id from organizations
on conflict (org_id) do nothing;

-- Email details on each message: its Message-ID for threading and dedupe, and whether it was delivered
alter table ticket_messages add column if not exists email_message_id text;
alter table ticket_messages add column if not exists delivery text
  check (delivery in ('sent', 'not_sent', 'failed'));
alter table ticket_messages add column if not exists delivery_note text;

create index if not exists ticket_messages_email_id_idx on ticket_messages (email_message_id)
  where email_message_id is not null;

-- When the survey email went out, so it's only sent once
alter table tickets add column if not exists survey_sent_at timestamptz;
