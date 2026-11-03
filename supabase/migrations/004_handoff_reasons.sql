-- Why the bot handed a chat to an agent, and which articles each answer used.
-- Powers the Knowledge Gaps report. Run once in the Supabase SQL Editor.

alter table bot_conversations add column if not exists handoff_reason text;

-- not_covered: no article answers it (a knowledge gap)
-- needs_staff: only staff can do it (order lookup, refund, warranty claim)
-- customer_request: the customer asked for a person
-- upset: the customer was angry or the steps didn't help
-- unavailable: the AI couldn't answer (quota or error)
alter table bot_conversations add column if not exists handoff_type text
  check (handoff_type in ('not_covered', 'needs_staff', 'customer_request', 'upset', 'unavailable'));

alter table bot_messages add column if not exists sources text[] not null default '{}';
