-- Letting people write their own feed entries.
--
-- Everything in the feed is written by a trigger: finishing a workout, setting
-- a record, unlocking an achievement. That is why there is no insert policy on
-- feed_events — the comment in policies.sql says so outright. It also means the
-- feed is a log, and a log is something you read rather than take part in.
--
-- One narrow exception: a post of your own, with text and nothing else. Every
-- other kind stays trigger-only, so nobody can fabricate a record or a streak
-- by inserting a row that claims one.

begin;

-- feed_events only accepted the four trigger-written kinds. Without 'post' in
-- the check, create_post below would compile and then fail on every insert.
alter table public.feed_events drop constraint if exists feed_events_kind_check;
alter table public.feed_events
  add constraint feed_events_kind_check
  check (kind = any (array['workout', 'achievement', 'record', 'streak', 'post']));

/**
 * Writes one post as the signed-in user.
 *
 * A function rather than an insert policy: a policy permissive enough to allow
 * `kind = 'post'` has to be written as `with check (user_id = auth.uid() and
 * kind = 'post')`, and a permissive policy is ORed with any other insert policy
 * added later — which is how the workout_completions table ended up readable by
 * everyone in this project once already. No insert policy means no way in
 * except through here.
 */
create or replace function public.create_post(p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := auth.uid();
  clean   text := btrim(coalesce(p_text, ''));
  new_id  uuid;
  recent  integer;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if clean = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;
  if length(clean) > 500 then
    return jsonb_build_object('ok', false, 'reason', 'too_long');
  end if;

  -- Ten an hour. Not a security boundary, a politeness one: the feed is shared
  -- with your friends and a loop posting into it makes it unusable for them.
  select count(*) into recent
    from public.feed_events
   where user_id = me and kind = 'post' and created_at > now() - interval '1 hour';

  if recent >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  insert into public.feed_events (user_id, kind, title, subtitle, meta)
  values (me, 'post', clean, null, '{}'::jsonb)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

revoke all on function public.create_post(text) from public;
grant execute on function public.create_post(text) to authenticated;

commit;
