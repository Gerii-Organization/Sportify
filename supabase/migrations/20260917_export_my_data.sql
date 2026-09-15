-- Export my data (roadmap Q6).
--
-- GDPR article 20 gives people the right to receive the data they gave an app
-- "in a structured, commonly used and machine-readable format". Deleting an
-- account was already possible; taking your data with you was not.
--
-- One call returns everything tied to the caller as a single JSON document,
-- grouped by what it is rather than by table name. It reads the same tables
-- delete_my_account erases, plus the ones added since, so the two lists can be
-- compared side by side when a table is added.
--
-- SECURITY DEFINER with every query pinned to auth.uid(): a few tables have no
-- select policy for their owner (scan_usage, for one), and an export that
-- silently skipped them would not be complete. Direct messages include both
-- sides of the caller's own conversations, which is what someone asking for
-- "my messages" expects.

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  return jsonb_build_object(
    'ok', true,
    'format', 'sportify-export-v1',
    'exported_at', now(),
    'account', jsonb_build_object(
      'id', me,
      'email', (select u.email from auth.users u where u.id = me),
      'created_at', (select u.created_at from auth.users u where u.id = me)
    ),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = me),

    'training', jsonb_build_object(
      'routines',          coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.user_workouts t where t.user_id = me), '[]'::jsonb),
      'sessions',          coalesce((select jsonb_agg(to_jsonb(t) order by t.completed_at) from public.workout_completions t where t.user_id = me), '[]'::jsonb),
      'personal_records',  coalesce((select jsonb_agg(to_jsonb(t)) from public.personal_records t where t.user_id = me), '[]'::jsonb),
      'saved_routines',    coalesce((select jsonb_agg(to_jsonb(t)) from public.saved_workouts t where t.user_id = me), '[]'::jsonb)
    ),

    'health', jsonb_build_object(
      'body_weight',  coalesce((select jsonb_agg(to_jsonb(t)) from public.body_weight_log t where t.user_id = me), '[]'::jsonb),
      'daily_stats',  coalesce((select jsonb_agg(to_jsonb(t) order by t.date) from public.daily_stats t where t.user_id = me), '[]'::jsonb),
      'daily_steps',  coalesce((select jsonb_agg(to_jsonb(t) order by t.record_date) from public.daily_steps t where t.user_id = me), '[]'::jsonb)
    ),

    'nutrition', jsonb_build_object(
      'meals',       coalesce((select jsonb_agg(to_jsonb(t) order by t.scanned_at) from public.scanned_foods t where t.user_id = me), '[]'::jsonb),
      'favourites',  coalesce((select jsonb_agg(to_jsonb(t)) from public.favorite_foods t where t.user_id = me), '[]'::jsonb),
      'scan_usage',  coalesce((select jsonb_agg(to_jsonb(t)) from public.scan_usage t where t.user_id = me), '[]'::jsonb)
    ),

    'progress', jsonb_build_object(
      'achievements',        coalesce((select jsonb_agg(to_jsonb(t)) from public.user_achievements t where t.user_id = me), '[]'::jsonb),
      'inventory',           coalesce((select jsonb_agg(to_jsonb(t)) from public.user_inventory t where t.user_id = me), '[]'::jsonb),
      'streak_milestones',   coalesce((select jsonb_agg(to_jsonb(t)) from public.streak_milestones t where t.user_id = me), '[]'::jsonb),
      'weekly_quest_claims', coalesce((select jsonb_agg(to_jsonb(t)) from public.weekly_quest_claims t where t.user_id = me), '[]'::jsonb),
      'daily_quests',        coalesce((select jsonb_agg(to_jsonb(t)) from public.tasks t where t.user_id = me), '[]'::jsonb)
    ),

    'social', jsonb_build_object(
      'friendships',     coalesce((select jsonb_agg(to_jsonb(t)) from public.friendships t where t.user_id = me or t.friend_id = me), '[]'::jsonb),
      'follows',         coalesce((select jsonb_agg(to_jsonb(t)) from public.follows t where t.follower_id = me or t.followee_id = me), '[]'::jsonb),
      'blocks',          coalesce((select jsonb_agg(to_jsonb(t)) from public.blocks t where t.blocker_id = me), '[]'::jsonb),
      'messages',        coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.messages t where t.sender_id = me or t.receiver_id = me), '[]'::jsonb),
      'groups_created',  coalesce((select jsonb_agg(to_jsonb(t)) from public.groups t where t.created_by = me), '[]'::jsonb),
      'group_memberships', coalesce((select jsonb_agg(to_jsonb(t)) from public.group_members t where t.user_id = me), '[]'::jsonb),
      'group_messages',  coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.group_messages t where t.sender_id = me), '[]'::jsonb),
      'posts_and_activity', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.feed_events t where t.user_id = me), '[]'::jsonb),
      'comments',        coalesce((select jsonb_agg(to_jsonb(t)) from public.feed_comments t where t.user_id = me), '[]'::jsonb),
      'likes',           coalesce((select jsonb_agg(to_jsonb(t)) from public.feed_likes t where t.user_id = me), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
