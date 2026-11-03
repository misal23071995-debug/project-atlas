-- Self-service support bot: help articles, bot conversations and their messages.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it only creates what is missing and seeds the articles once.

create table if not exists kb_articles (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bot_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  -- active: still chatting, resolved: customer said it helped, handed_off: passed to an agent
  status text not null default 'active'
    check (status in ('active', 'resolved', 'handed_off')),
  topic text,
  ticket_id bigint references tickets (id) on delete set null,
  customer_messages integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bot_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references bot_conversations (id) on delete cascade,
  role text not null check (role in ('customer', 'bot')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists bot_messages_conversation_idx on bot_messages (conversation_id, created_at);
create index if not exists bot_conversations_created_idx on bot_conversations (created_at desc);

-- No browser access; the Next.js server uses the secret key
alter table kb_articles enable row level security;
alter table bot_conversations enable row level security;
alter table bot_messages enable row level security;

-- Sample articles for the fictional "Atlas Ring" brand (only when the table is empty)
insert into kb_articles (title, category, body)
select title, category, body
from (values
  ('Setting up your Atlas Ring', 'Getting Started',
   'Charge the ring for 30 minutes before first use. Install the Atlas app (iOS 16+ or Android 10+), create an account, then tap "Add ring" and hold the ring next to your phone. Pairing takes about a minute. Wear the ring on your index or middle finger for the most accurate readings. Your first sleep and readiness scores appear after two nights of wear.'),

  ('Ring not syncing with the app', 'Sync & App',
   'Try these steps in order: 1) Make sure Bluetooth is on and the Atlas app has Bluetooth and background-refresh permission. 2) Put the ring on its charger for 10 seconds, then take it off to wake it. 3) Force-close and reopen the app. 4) Restart your phone. 5) If it still will not sync, open Settings > Ring > Forget ring in the app, then pair again; your data is stored in your account and is not lost. If none of this works, contact support with your phone model and app version.'),

  ('Sync stopped after a firmware update', 'Sync & App',
   'Firmware updates can take up to 15 minutes. Keep the ring on the charger and the app open until the update finishes. If sync stopped afterwards, place the ring on the charger, open the app and pull down on the home screen to retry the update. If the app shows "Update failed" twice, contact support so the team can check the ring remotely.'),

  ('Improving battery life', 'Battery & Charging',
   'A full charge lasts 5 to 7 days. Battery drains faster with continuous heart-rate mode, frequent manual syncs, or very cold temperatures. To extend it: turn off continuous heart-rate in Settings > Health, let the app sync in the background instead of opening it often, and keep the app updated. If a fully charged ring lasts less than 2 days, contact support because it may need a battery check under warranty.'),

  ('Charging your ring', 'Battery & Charging',
   'Place the ring on the charging dock with the sensor bumps facing inward. The light turns white while charging and green when full; a full charge takes about 80 minutes. Use the included cable with any 5V USB adapter. If the light does not turn on, clean the charging contacts with a dry cloth and try a different USB port.'),

  ('Choosing the right size', 'Sizing',
   'Order the free sizing kit before buying the ring. Wear the sample ring for 24 hours on the finger you plan to use. It should feel snug but turn with light pressure. Atlas Ring comes in sizes 6 to 13. If your ring does not fit, you can exchange it for another size free of charge within 30 days of delivery.'),

  ('Order status and shipping times', 'Orders & Shipping',
   'Orders ship within 2 business days. Standard delivery takes 3 to 7 business days in India and 7 to 14 business days internationally. You receive a tracking link by email as soon as your order ships. The support bot cannot look up individual orders; for a specific order, ask to talk to a person and include your order number.'),

  ('Returns and refunds', 'Returns & Refunds',
   'You can return an Atlas Ring within 30 days of delivery for a full refund, as long as it is undamaged and in its original box. Start a return by contacting support with your order number; the team emails a prepaid return label. Refunds go back to the original payment method within 5 to 10 business days after the return arrives. Sizing kits are free and do not need to be returned.'),

  ('Warranty coverage', 'Warranty',
   'Every Atlas Ring has a 1-year limited warranty from the delivery date. It covers manufacturing defects, battery failure and charging faults. It does not cover scratches, accidental damage or loss. To make a warranty claim, contact support with your order number and a short description or photo of the problem; a support agent reviews every claim.'),

  ('Your data and privacy', 'Account & Privacy',
   'Your health data is encrypted and stored in your Atlas account. Atlas never sells your data. You can export all of your data from Settings > Account > Export data, or permanently delete your account from Settings > Account > Delete account. To change the email on your account, go to Settings > Account > Email.')
) as seed (title, category, body)
where not exists (select 1 from kb_articles);
