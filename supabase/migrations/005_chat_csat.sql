-- Customer satisfaction rating at the end of each chatbot conversation.
-- Run once in the Supabase SQL Editor.

alter table bot_conversations add column if not exists csat_rating integer
  check (csat_rating between 1 and 5);
alter table bot_conversations add column if not exists csat_comment text;
alter table bot_conversations add column if not exists rated_at timestamptz;
