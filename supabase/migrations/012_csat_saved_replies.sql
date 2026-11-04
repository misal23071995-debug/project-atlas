-- Ticket CSAT: each ticket gets a private survey link the customer can use to rate it.
-- Saved replies: ready-made answers per workspace, inserted into the reply box with placeholders filled in.
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table tickets add column if not exists csat_token uuid not null default gen_random_uuid();
alter table tickets add column if not exists csat_rating integer check (csat_rating between 1 and 5);
alter table tickets add column if not exists csat_comment text;
alter table tickets add column if not exists csat_rated_at timestamptz;

create unique index if not exists tickets_csat_token_idx on tickets (csat_token);

create table if not exists saved_replies (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  category text not null default 'Other',
  body text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_replies_org_idx on saved_replies (org_id, title);

alter table saved_replies enable row level security;

-- A starter set for every workspace that has none yet
insert into saved_replies (org_id, title, category, body, created_by)
select o.id, r.title, r.category, r.body, 'Atlas'
from organizations o
cross join (values
  ('Sync troubleshooting', 'Sync & App',
   E'Hi {{customer_first_name}},\n\nSorry the ring isn''t syncing. Please try these steps in order:\n1. Put the ring on its charger for 10 seconds, then take it off.\n2. Check the app has Bluetooth and background refresh allowed.\n3. Pull down on the home screen to sync.\n\nYour data is stored on the ring for up to a week, so nothing is lost. Let me know how it goes.\n\n{{agent_name}}'),
  ('Refund issued', 'Returns & Refunds',
   E'Hi {{customer_first_name}},\n\nI''ve issued your refund today. It usually takes 5 to 10 business days to show in your account, depending on your bank.\n\nIf you need anything else, just reply to this message.\n\n{{agent_name}}'),
  ('Size exchange', 'Sizing',
   E'Hi {{customer_first_name}},\n\nNo problem, size exchanges are free within 30 days of delivery. I''ve emailed you a prepaid return label, and your new size ships as soon as the courier collects the old one.\n\n{{agent_name}}'),
  ('Need more details', 'Other',
   E'Hi {{customer_first_name}},\n\nThanks for getting in touch. So I can help, could you send me your order number and the model of your phone?\n\nI''ll keep ticket #{{ticket_id}} open for you in the meantime.\n\n{{agent_name}}'),
  ('Closing and survey', 'Other',
   E'Hi {{customer_first_name}},\n\nGlad that''s sorted. I''ll close this ticket now, but you can reply any time if something comes up.\n\nWe''d love to know how we did: {{survey_link}}\n\n{{agent_name}}')
) as r (title, category, body)
where not exists (select 1 from saved_replies s where s.org_id = o.id);
