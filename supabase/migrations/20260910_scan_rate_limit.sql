-- Rate limit for the meal scanner.
--
-- `analyse-food` calls OpenAI, so every scan costs money that the app operator
-- pays. Without a limit, one signed-in account can loop the endpoint and empty
-- the budget in an afternoon — and it does not even take malice, a retry loop
-- in a bad network does the same thing.
--
-- Counted in the database rather than in the function: an Edge Function has no
-- memory between invocations, and anything held in one instance is not shared
-- with the others.

create table if not exists public.scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default (now() at time zone 'utc')::date,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.scan_usage enable row level security;

-- Readable by its owner so the app can show "3 of 20 scans left today".
-- Writes go only through the function below, which runs as definer — a client
-- that could update this row could grant itself unlimited scans.
drop policy if exists "own scan usage" on public.scan_usage;
create policy "own scan usage" on public.scan_usage
  for select using (auth.uid() = user_id);

/**
 * Claims one scan for today. Returns the remaining allowance, or -1 when the
 * limit is already spent.
 *
 * The insert-on-conflict is what makes it safe under concurrency: two requests
 * arriving together both go through the same row lock, so neither can read a
 * stale count and write the same total back. That read-modify-write is the bug
 * class that wiped XP in this project once already.
 */
create or replace function public.claim_scan(p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  used  integer;
begin
  if auth.uid() is null then
    return -1;
  end if;

  insert into public.scan_usage (user_id, day, count)
  values (auth.uid(), today, 1)
  on conflict (user_id, day)
  do update set count = public.scan_usage.count + 1
  returning count into used;

  if used > p_limit then
    -- Over the line. Put the increment back so the count reflects allowed
    -- scans rather than attempts, and refuse.
    update public.scan_usage
       set count = p_limit
     where user_id = auth.uid() and day = today;
    return -1;
  end if;

  return p_limit - used;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, which includes anon. Revoking
-- from anon alone does nothing — it has to come off PUBLIC first.
revoke all on function public.claim_scan(integer) from public;
grant execute on function public.claim_scan(integer) to authenticated;
