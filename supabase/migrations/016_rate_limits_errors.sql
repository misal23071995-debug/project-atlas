-- Rate limits for the public pages (customer chat, survey, email webhook, sign-up),
-- and a log of server errors so problems on the live site are recorded.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- One row per key per time window, counting requests
create table if not exists rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table rate_limit_hits enable row level security;

-- Counts one request and says whether it's within the limit. Atomic, so two requests at once can't both slip through.
create or replace function hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c integer;
begin
  insert into rate_limit_hits (key, window_start, count)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set count = rate_limit_hits.count + 1
  returning count into c;

  -- Now and then, clear out old windows
  if random() < 0.01 then
    delete from rate_limit_hits where window_start < now() - interval '2 days';
  end if;

  return c <= p_limit;
end;
$$;

-- Only the server (secret key) may call it, not the browser
revoke execute on function hit_rate_limit(text, integer, integer) from public, anon, authenticated;

create table if not exists error_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- Next.js's id for the error, also shown to the user on the error page
  digest text,
  message text not null,
  stack text,
  method text,
  path text,
  -- render, action, route or proxy
  kind text,
  route text
);

create index if not exists error_events_time_idx on error_events (occurred_at desc);

alter table error_events enable row level security;
