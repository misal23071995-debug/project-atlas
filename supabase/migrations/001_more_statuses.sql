-- Allow the statuses and priorities the ticket page offers.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table tickets drop constraint if exists tickets_status_check;
alter table tickets add constraint tickets_status_check
  check (status in ('Open', 'Pending', 'Waiting on Customer', 'Escalated', 'Resolved', 'Closed'));

alter table tickets drop constraint if exists tickets_priority_check;
alter table tickets add constraint tickets_priority_check
  check (priority in ('Low', 'Medium', 'High', 'Urgent'));
