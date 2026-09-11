-- Following, as distinct from friendship.
--
-- Friendship is mutual and needs accepting; following is one-way and needs
-- nobody's permission. They answer different questions: a friend is someone you
-- train alongside, a follow is someone whose training you want to see. An
-- athlete with two thousand followers does not want two thousand friend
-- requests, and the app currently forces exactly that.

begin;

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  -- Following yourself would inflate your own count and appear in your own feed.
  constraint no_self_follow check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

-- Counts are public — that is the point of a follower count. Rows are readable
-- so a profile can say whether YOU follow it.
drop policy if exists "follows are readable" on public.follows;
create policy "follows are readable" on public.follows
  for select to authenticated using (true);

drop policy if exists "you follow as yourself" on public.follows;
create policy "you follow as yourself" on public.follows
  for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "you unfollow your own follows" on public.follows;
create policy "you unfollow your own follows" on public.follows
  for delete to authenticated using (auth.uid() = follower_id);

/**
 * Follow or unfollow, whichever applies. Returns the new state.
 *
 * One call rather than an insert and a delete the client has to choose
 * between: the client's idea of whether it already follows can be stale, and
 * picking the wrong one produces either a duplicate-key error or a silent no-op.
 */
create or replace function public.toggle_follow(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  existed  boolean;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if me = p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- Blocks cut both ways, same as everywhere else in the app.
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = me and b.blocked_id = p_user_id)
       or (b.blocker_id = p_user_id and b.blocked_id = me)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

  delete from public.follows
   where follower_id = me and followee_id = p_user_id;

  get diagnostics existed = row_count;

  if existed then
    return jsonb_build_object('ok', true, 'following', false);
  end if;

  insert into public.follows (follower_id, followee_id) values (me, p_user_id);
  return jsonb_build_object('ok', true, 'following', true);
end;
$$;

/**
 * Followers, following and friends for one profile, in one round trip.
 *
 * Friends are counted here too so a profile needs one call rather than three —
 * the three numbers are always shown together and never on their own.
 */
create or replace function public.get_social_counts(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'followers', (select count(*) from public.follows where followee_id = p_user_id),
    'following', (select count(*) from public.follows where follower_id = p_user_id),
    'friends',   (select count(*) from public.friendships
                   where status = 'accepted'
                     and (user_id = p_user_id or friend_id = p_user_id)),
    'i_follow',  exists (
                   select 1 from public.follows
                   where follower_id = auth.uid() and followee_id = p_user_id
                 )
  );
$$;

-- Postgres grants EXECUTE to PUBLIC by default; revoking from anon alone does
-- nothing.
revoke all on function public.toggle_follow(uuid) from public;
revoke all on function public.get_social_counts(uuid) from public;
grant execute on function public.toggle_follow(uuid) to authenticated;
grant execute on function public.get_social_counts(uuid) to authenticated;

commit;
