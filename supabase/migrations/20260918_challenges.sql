-- Challenges between friends (roadmap S1).
--
-- Someone starts a challenge — "most days trained this week", or "most minutes"
-- — and invites up to ten friends. Invitees join or decline. When it ends, the
-- top scorer earns energy, and everyone who trained at all earns a little.
--
-- What is counted, and why:
--   days     distinct days with a finished workout, in UTC. One per day however
--            many sessions, so calling complete_workout over and over wins
--            nothing.
--   minutes  workout minutes, each session counted for at most 180.
-- Both come from workout_completions, which only complete_workout writes.
--
-- Guards against farming with spare accounts:
--   · only accepted friends can be invited
--   · the reward needs at least two people who joined, and a challenge of at
--     least three days
--   · a person can have at most three active challenges they created
--   · winners need a score above zero
--
-- Nothing runs on a schedule. A challenge that has ended is settled the first
-- time any participant loads their challenges (settle_my_challenges), and
-- settling twice changes nothing: the status flips to 'settled' in the same
-- statement that pays.

create table if not exists public.challenges (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 3 and 60),
  metric     text not null check (metric in ('days', 'minutes')),
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null,
  status     text not null default 'active' check (status in ('active', 'settled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '31 days')
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  responded_at timestamptz,
  score        numeric not null default 0,
  reward       int not null default 0,
  primary key (challenge_id, user_id)
);

create index if not exists challenge_participants_user on public.challenge_participants (user_id);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

-- Readable to the people in it; written only by the functions below.
create or replace function public.in_challenge(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_participants
     where challenge_id = p_challenge and user_id = auth.uid()
  );
$$;

revoke all on function public.in_challenge(uuid) from public, anon;
grant execute on function public.in_challenge(uuid) to authenticated;

drop policy if exists "Challenges you are in" on public.challenges;
create policy "Challenges you are in"
  on public.challenges for select
  to authenticated
  using (public.in_challenge(id));

drop policy if exists "Participants of challenges you are in" on public.challenge_participants;
create policy "Participants of challenges you are in"
  on public.challenge_participants for select
  to authenticated
  using (public.in_challenge(challenge_id));

revoke insert, update, delete on public.challenges from anon, authenticated;
revoke insert, update, delete on public.challenge_participants from anon, authenticated;

-- A participant's score over a challenge's window, so far.
create or replace function public.challenge_score(p_user uuid, p_metric text, p_from timestamptz, p_to timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case p_metric
    when 'days' then (
      select count(distinct (wc.completed_at at time zone 'UTC')::date)
        from public.workout_completions wc
       where wc.user_id = p_user and wc.completed_at >= p_from and wc.completed_at < p_to
    )
    when 'minutes' then (
      select coalesce(sum(least(wc.duration_minutes, 180)), 0)
        from public.workout_completions wc
       where wc.user_id = p_user and wc.completed_at >= p_from and wc.completed_at < p_to
    )
    else 0
  end::numeric;
$$;

-- Takes a user id, so it must not be callable from the API.
revoke all on function public.challenge_score(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.create_challenge(p_title text, p_metric text, p_days int, p_friends uuid[])
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  friends  uuid[];
  new_id   uuid;
begin
  if me is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if p_metric not in ('days', 'minutes') then
    return json_build_object('ok', false, 'reason', 'bad_metric');
  end if;
  if p_days is null or p_days < 1 or p_days > 31 then
    return json_build_object('ok', false, 'reason', 'bad_length');
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 60 then
    return json_build_object('ok', false, 'reason', 'bad_title');
  end if;

  if (select count(*) from public.challenges where creator_id = me and status = 'active' and ends_at > now()) >= 3 then
    return json_build_object('ok', false, 'reason', 'too_many_active');
  end if;

  -- Only accepted friends, duplicates and yourself removed, ten at most.
  select coalesce(array_agg(distinct f), '{}') into friends
    from unnest(coalesce(p_friends, '{}')) f
   where f <> me
     and exists (
       select 1 from public.friendships fr
        where fr.status = 'accepted'
          and ((fr.user_id = me and fr.friend_id = f) or (fr.friend_id = me and fr.user_id = f))
     );

  if cardinality(friends) = 0 then
    return json_build_object('ok', false, 'reason', 'no_friends');
  end if;
  if cardinality(friends) > 10 then
    return json_build_object('ok', false, 'reason', 'too_many_friends');
  end if;

  insert into public.challenges (creator_id, title, metric, starts_at, ends_at)
  values (me, btrim(p_title), p_metric, now(), now() + make_interval(days => p_days))
  returning id into new_id;

  insert into public.challenge_participants (challenge_id, user_id, status, responded_at)
  values (new_id, me, 'joined', now());

  insert into public.challenge_participants (challenge_id, user_id)
  select new_id, f from unnest(friends) f;

  return json_build_object('ok', true, 'id', new_id);
end;
$$;

create or replace function public.respond_challenge(p_challenge uuid, p_join boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  update public.challenge_participants cp
     set status = case when p_join then 'joined' else 'declined' end,
         responded_at = now()
    from public.challenges c
   where cp.challenge_id = p_challenge
     and cp.user_id = me
     and cp.status = 'invited'
     and c.id = cp.challenge_id
     and c.status = 'active'
     and c.ends_at > now();

  if not found then
    return json_build_object('ok', false, 'reason', 'not_invited');
  end if;
  return json_build_object('ok', true);
end;
$$;

-- Pays out every ended challenge the caller is in. Idempotent.
create or replace function public.settle_my_challenges()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  ch       record;
  top      numeric;
  joined   int;
  settled  int := 0;
  winner_bonus      constant int := 300;
  participant_bonus constant int := 50;
begin
  if me is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  for ch in
    select c.* from public.challenges c
     where c.status = 'active' and c.ends_at <= now()
       and exists (select 1 from public.challenge_participants p where p.challenge_id = c.id and p.user_id = me)
     for update of c skip locked
  loop
    update public.challenge_participants p
       set score = public.challenge_score(p.user_id, ch.metric, ch.starts_at, ch.ends_at)
     where p.challenge_id = ch.id and p.status = 'joined';

    select count(*), coalesce(max(score), 0) into joined, top
      from public.challenge_participants where challenge_id = ch.id and status = 'joined';

    if joined >= 2 and ch.ends_at - ch.starts_at >= interval '3 days' and top > 0 then
      update public.challenge_participants
         set reward = case when score = top then winner_bonus else participant_bonus end
       where challenge_id = ch.id and status = 'joined' and score > 0;

      update public.profiles pr
         set energy_points = coalesce(pr.energy_points, 0) + p.reward
        from public.challenge_participants p
       where p.challenge_id = ch.id and p.user_id = pr.id and p.reward > 0;
    end if;

    update public.challenges set status = 'settled' where id = ch.id;
    settled := settled + 1;
  end loop;

  return json_build_object('ok', true, 'settled', settled);
end;
$$;

-- Everything the challenges screen shows, live scores included.
create or replace function public.get_my_challenges()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(x) order by x.sort_key, x.ends_at desc), '[]'::json)
  from (
    select
      c.id, c.title, c.metric, c.starts_at, c.ends_at, c.status,
      c.creator_id = auth.uid() as created_by_me,
      mine.status as my_status,
      mine.reward as my_reward,
      case when c.status = 'active' and mine.status = 'invited' then 0
           when c.status = 'active' then 1
           else 2 end as sort_key,
      (
        select json_agg(json_build_object(
                 'user_id', p.user_id,
                 'first_name', pr.first_name,
                 'avatar_url', pr.avatar_url,
                 'equipped_avatar', pr.equipped_avatar,
                 'xp', pr.xp,
                 'status', p.status,
                 'reward', p.reward,
                 'score', case when c.status = 'settled' then p.score
                               when p.status = 'joined' then public.challenge_score(p.user_id, c.metric, c.starts_at, least(now(), c.ends_at))
                               else 0 end
               ) order by (p.status = 'joined') desc, p.score desc)
          from public.challenge_participants p
          join public.profiles pr on pr.id = p.user_id
         where p.challenge_id = c.id
      ) as participants
    from public.challenges c
    join public.challenge_participants mine on mine.challenge_id = c.id and mine.user_id = auth.uid()
    where auth.uid() is not null
      and mine.status <> 'declined'
      and (c.status = 'active' or c.ends_at > now() - interval '30 days')
  ) x;
$$;

revoke all on function public.create_challenge(text, text, int, uuid[]) from public, anon;
revoke all on function public.respond_challenge(uuid, boolean) from public, anon;
revoke all on function public.settle_my_challenges() from public, anon;
revoke all on function public.get_my_challenges() from public, anon;
grant execute on function public.create_challenge(text, text, int, uuid[]) to authenticated;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;
grant execute on function public.settle_my_challenges() to authenticated;
grant execute on function public.get_my_challenges() to authenticated;
