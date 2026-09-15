-- export_my_data gains the body section (T6): measurements, and the list of
-- progress photos with their storage paths. The files themselves stay in the
-- private bucket; the export says what exists and where, and the app can hand
-- out signed links to them. Everything else is unchanged from
-- 20260917_export_my_data.sql.

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
      'daily_steps',  coalesce((select jsonb_agg(to_jsonb(t) order by t.record_date) from public.daily_steps t where t.user_id = me), '[]'::jsonb),
      'measurements', coalesce((select jsonb_agg(to_jsonb(t) order by t.measured_on) from public.body_measurements t where t.user_id = me), '[]'::jsonb),
      'progress_photos', coalesce((select jsonb_agg(jsonb_build_object('path', t.path, 'pose', t.pose, 'taken_on', t.taken_on) order by t.taken_on) from public.progress_photos t where t.user_id = me), '[]'::jsonb)
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
