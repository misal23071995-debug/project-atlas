-- Live chat: after the bot hands over, the customer and an agent keep talking in the same chat window.
-- The ticket's messages are the conversation from then on; these columns track whether the customer is still there.

-- Updated each time the customer's chat window checks for new messages (every few seconds while it's open)
alter table bot_conversations add column if not exists customer_last_seen_at timestamptz;
-- Set when the customer clicks "End chat"
alter table bot_conversations add column if not exists customer_left_at timestamptz;

-- The ticket page looks up its chat by ticket id
create index if not exists bot_conversations_ticket_idx on bot_conversations (ticket_id)
  where ticket_id is not null;

-- A reply can now be delivered into the chat window, as well as by email
alter table ticket_messages drop constraint if exists ticket_messages_delivery_check;
alter table ticket_messages add constraint ticket_messages_delivery_check
  check (delivery in ('sent', 'not_sent', 'failed', 'chat'));
