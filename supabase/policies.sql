-- Sportify — database reference
--
-- Generated from the live project's catalogue, not written by hand, so it
-- reflects what is actually deployed. The previous version had drifted badly:
-- it documented daily_spin (since dropped) and none of the fifteen functions
-- added after it, so anyone cloning the repo got a description of a database
-- that no longer existed.
--
-- This file is DOCUMENTATION, not a migration. Applying it will not build the
-- schema — tables and column definitions are not here. Migrations live in the
-- Supabase project's own history.
--
-- Two rules the whole design rests on:
--
-- 1. RLS IS THE ONLY BOUNDARY. The anon key ships inside the app bundle and is
--    extractable, so anything a policy permits is effectively public to anyone
--    holding it. Filtering in the client is presentation, never protection.
--
-- 2. PERMISSIVE POLICIES COMBINE WITH OR. Two policies on one table mean the
--    looser one wins. This has bitten the project three times — block
--    enforcement, then workout_completions, and it is still open on profiles
--    (see the note at the end). After adding any policy, check the table for
--    others:
--
--      select tablename, policyname, cmd, roles, qual
--        from pg_policies
--       where schemaname = 'public' and qual::text not like '%auth.uid()%';


-- ============================================================================
-- Row Level Security
-- ============================================================================

-- Enabled on every table except one.
alter table public.achievements        enable row level security;
alter table public.blocks              enable row level security;
alter table public.body_weight_log     enable row level security;
alter table public.daily_stats         enable row level security;
alter table public.daily_steps         enable row level security;
alter table public.feed_comments       enable row level security;
alter table public.feed_events         enable row level security;
alter table public.feed_likes          enable row level security;
alter table public.friendships         enable row level security;
alter table public.group_members       enable row level security;
alter table public.group_messages      enable row level security;
alter table public.groups              enable row level security;
alter table public.messages            enable row level security;
alter table public.personal_records    enable row level security;
alter table public.profiles            enable row level security;
alter table public.saved_workouts      enable row level security;
alter table public.scanned_foods       enable row level security;
alter table public.tasks               enable row level security;
alter table public.todos               enable row level security;
alter table public.user_achievements   enable row level security;
alter table public.user_inventory      enable row level security;
alter table public.user_workouts       enable row level security;
alter table public.workout_completions enable row level security;
alter table public.workout_exercises   enable row level security;
alter table public.workouts            enable row level security;

-- NOT ENABLED: public.meals — a legacy table, 0 rows, nothing reads it.
-- Left as-is deliberately rather than remediated: enabling RLS with no policies
-- blocks all access, and dropping a table is not a decision to make in passing.
--   alter table public.meals enable row level security;   -- or drop it


-- ============================================================================
-- Owner-only tables
-- ============================================================================
-- The plain case: you see and change your own rows, nobody else's.

create policy "own rows" on public.body_weight_log     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.personal_records    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.saved_workouts      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.daily_stats         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.daily_steps         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.scanned_foods       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.tasks               for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.user_inventory      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.workout_completions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workout_completions once carried a second policy granting every signed-in
-- user SELECT on every row. Verified at the time: acting as one account, 33
-- rows across 7 owners were readable. It was dropped; the public profile now
-- reads through get_public_workouts, which returns four columns and honours
-- blocks. Row-level policies cannot hide columns, which is why that had to
-- become a function.


-- ============================================================================
-- Workouts: yours always, others' only when published
-- ============================================================================

create policy "own rows" on public.user_workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read public workouts" on public.user_workouts
  for select to authenticated using (is_public or user_id = auth.uid());

-- is_public defaults to false. Publishing is opt-in, per author, per workout.


-- ============================================================================
-- Social: friendship, blocks, messages
-- ============================================================================
-- Blocks are enforced here rather than in the client. A client-side check is
-- cosmetic: anyone with the anon key queries the table directly.

create policy "manage own blocks" on public.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy "read own blocks" on public.blocks
  for select using (blocker_id = auth.uid() or blocked_id = auth.uid());

create policy "read own friendships" on public.friendships
  for select to authenticated using (user_id = auth.uid() or friend_id = auth.uid());

create policy "send friend request" on public.friendships
  for insert to authenticated
  with check (user_id = auth.uid() and not is_blocked_pair(user_id, friend_id));

create policy "respond to friend request" on public.friendships
  for update to authenticated using (friend_id = auth.uid()) with check (friend_id = auth.uid());

create policy "remove friendship" on public.friendships
  for delete to authenticated using (user_id = auth.uid() or friend_id = auth.uid());

create policy "read own messages" on public.messages
  for select using (
    (sender_id = auth.uid() or receiver_id = auth.uid())
    and not is_blocked_pair(sender_id, receiver_id)
  );

create policy "send messages" on public.messages
  for insert with check (sender_id = auth.uid() and not is_blocked_pair(sender_id, receiver_id));

create policy "edit own messages" on public.messages
  for update using (sender_id = auth.uid() or receiver_id = auth.uid());


-- ============================================================================
-- Groups: membership is the key
-- ============================================================================

create policy "create groups" on public.groups
  for insert with check (created_by = auth.uid());

create policy "read own groups" on public.groups
  for select using (exists (select 1 from group_members m where m.group_id = groups.id and m.user_id = auth.uid()));

create policy "rename own group" on public.groups
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "delete own group" on public.groups
  for delete to authenticated using (created_by = auth.uid());

create policy "read members of own groups" on public.group_members
  for select using (exists (select 1 from group_members mine where mine.group_id = group_members.group_id and mine.user_id = auth.uid()));

create policy "add members to own groups" on public.group_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from groups g where g.id = group_members.group_id and g.created_by = auth.uid())
  );

create policy "leave group" on public.group_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from groups g where g.id = group_members.group_id and g.created_by = auth.uid())
  );

create policy "read group messages" on public.group_messages
  for select using (exists (select 1 from group_members m where m.group_id = group_messages.group_id and m.user_id = auth.uid()));

create policy "send group messages" on public.group_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from group_members m where m.group_id = group_messages.group_id and m.user_id = auth.uid())
  );


-- ============================================================================
-- Feed: yours and your friends'
-- ============================================================================
-- Rows are written by triggers on workouts, records and achievements, never by
-- the client — which is why there is no insert policy for feed_events.

create policy "read friends feed" on public.feed_events
  for select to authenticated using (user_id = auth.uid() or is_friend(user_id));

create policy "delete own event" on public.feed_events
  for delete to authenticated using (user_id = auth.uid());

create policy "read likes" on public.feed_likes
  for select to authenticated using (exists (
    select 1 from feed_events e where e.id = feed_likes.event_id and (e.user_id = auth.uid() or is_friend(e.user_id))
  ));

create policy "like as self" on public.feed_likes
  for insert to authenticated with check (user_id = auth.uid());

create policy "unlike own" on public.feed_likes
  for delete to authenticated using (user_id = auth.uid());

create policy "read comments" on public.feed_comments
  for select to authenticated using (exists (
    select 1 from feed_events e where e.id = feed_comments.event_id and (e.user_id = auth.uid() or is_friend(e.user_id))
  ));

create policy "comment as self" on public.feed_comments
  for insert to authenticated with check (user_id = auth.uid());

create policy "delete own comment" on public.feed_comments
  for delete to authenticated using (user_id = auth.uid());


-- ============================================================================
-- Shared reference data
-- ============================================================================

-- The twelve achievement definitions: names, descriptions, thresholds. Static
-- content, correctly readable by everyone signed in.
create policy "read achievements" on public.achievements
  for select to authenticated using (true);

-- Who has unlocked what. Readable by any signed-in user so a profile can show
-- someone's badges.
create policy "read unlocked" on public.user_achievements
  for select to authenticated using (true);


-- ============================================================================
-- Legacy tables
-- ============================================================================
-- `workouts` and `workout_exercises` predate `user_workouts`, which stores its
-- exercises as jsonb on the row. Nothing in the app reads either any more, but
-- the policies are still deployed, so they are recorded here — a file that
-- documents most of the database is the problem this rewrite was fixing.

create policy "Select workouts" on public.workouts for select using (auth.uid() = user_id);
create policy "Insert workouts" on public.workouts for insert with check (auth.uid() = user_id);
create policy "Update workouts" on public.workouts for update using (auth.uid() = user_id);
create policy "Delete workouts" on public.workouts for delete using (auth.uid() = user_id);

create policy "Select exercises" on public.workout_exercises
  for select using (exists (select 1 from workouts where workouts.id = workout_exercises.workout_id and workouts.user_id = auth.uid()));

create policy "Insert exercises" on public.workout_exercises
  for insert with check (exists (select 1 from workouts where workouts.id = workout_exercises.workout_id and workouts.user_id = auth.uid()));


-- ============================================================================
-- Profiles — SEE THE NOTE BELOW
-- ============================================================================

create policy "insert own profile" on public.profiles
  for insert with check (id = auth.uid());

create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Own row only. Both previous SELECT policies let any signed-in session read
-- every row, and being permissive they OR'd together, so dropping one changed
-- nothing. Measured before the change: 19 rows visible to one account, 18 of
-- them other people, all 18 with a weight recorded.
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());


-- The public half, as a view.
--
-- Row-level policies cannot restrict columns, so "everyone may see a name and a
-- level, nobody may see a weight" is not expressible as a policy. The view runs
-- as its owner (security_invoker = false) and selects only the safe columns.
--
-- Supabase's linter flags this as `security_definer_view`. That is the
-- mechanism, not a mistake: reading past the row policy is the entire point,
-- and what it returns is fixed by the column list below.
create view public.public_profiles as
  select p.id, p.first_name, p.xp, p.current_streak, p.workouts_per_week,
         p.equipped_avatar, p.equipped_ring, p.equipped_badge, p.equipped_title,
         p.created_at
    from public.profiles p;

alter view public.public_profiles set (security_invoker = false);
revoke all    on public.public_profiles from anon;
grant  select on public.public_profiles to authenticated;

-- Leaderboard, friend search, public profile, chat header and the comment and
-- group sheets all read the view. Anything reading profiles directly is reading
-- its own row.


-- ============================================================================
-- Functions
-- ============================================================================
-- All SECURITY DEFINER, all filtering by auth.uid() internally, all revoked
-- from anon. They exist because row-level policies cannot express column-level
-- rules, cross-row arithmetic, or anything that must be atomic.
--
--   add_water(p_ml int, p_tz text)                     -> json
--       Adds to today's total under a row lock and awards the goal XP in the
--       same transaction. Replaced a client read-modify-write where two quick
--       taps both read the same value and one was lost.
--
--   award_xp(xp_delta int, energy_delta int)           -> json
--       Increments in the database. Reading, adding and writing back is what
--       let the old daily spin reset people's totals to zero.
--
--   browse_workouts(p_limit int, p_search text, p_muscle text)
--       Public workouts, optionally filtered by muscle. The filter is here
--       rather than in the client because the limit applies first.
--
--   check_achievements()                               -> new unlocks
--   claim_daily_reward()                               -> json
--       The seven-day login ladder. Server decides the day and the amount, and
--       refuses a second claim on the same date.
--
--   complete_workout(..., p_tz text, p_exercises jsonb)-> json
--       Writes the session with its set snapshot, advances the streak (spending
--       a freeze on a missed day), and pays out. Re-derives volume from the
--       sets rather than trusting the client figure, which earns an XP bonus.
--
--   copy_workout(p_workout_id uuid)                    -> clones, sets cleared
--   get_exercise_history(p_name text)                  -> per-session bests
--   get_feed(p_limit int, p_before timestamptz)        -> paged feed
--   get_logged_exercises()                             -> everything trained
--   get_public_workouts(p_user_id uuid)                -> four columns, honours blocks
--   get_saved_workouts()                               -> bookmarks
--   get_streak_calendar(p_month date, p_tz text)       -> days trained
--   grant_streak_freeze()
--   is_blocked_pair(a uuid, b uuid)                    -> used inside policies
--   is_friend(other uuid)                              -> used inside policies
--   purchase_item(p_item_id text, p_item_type text, p_price int)
--       Checks the balance and grants in one transaction.
--   submit_sets(p_sets jsonb)                          -> only genuine records
--       Compares estimated 1RM server-side so a modified client cannot claim a
--       record it did not earn.
--   toggle_saved_workout(p_workout_id uuid)            -> boolean
--       Refuses to save a workout the caller is not allowed to see.
--
--   add_water(p_ml int, p_tz text)                     -> json
--   claim_daily_reward()                               -> json
--   get_achievement_progress()                         -> progress per badge
--   set_workout_note(p_completion_id uuid, p_note text)
--   delete_my_account()                                -> json
--       Erases every row the account owns, across all tables, then the auth
--       row. Named explicitly rather than relying on foreign keys: nine tables
--       cascade, nine are ON DELETE NO ACTION and would abort the delete, and
--       seven have no key to auth.users at all. Files go separately, through
--       the Storage API — storage.objects blocks direct SQL deletion.
--
-- GRANTS. Postgres gives EXECUTE on a new function to PUBLIC by default, and
-- PUBLIC includes anon, so `revoke ... from anon` alone leaves the privilege in
-- place — sixteen functions here were anon-callable for exactly that reason.
-- The pattern is:
--
--   revoke execute on function <sig> from public;
--   grant  execute on function <sig> to authenticated;
--
-- Trigger functions (no direct grants needed): feed_on_workout,
-- feed_on_record, feed_on_achievement.


-- ============================================================================
-- Storage
-- ============================================================================
-- workout_covers: public to read, 3 MB, jpeg/png/webp only. Files are stored at
-- <user-id>/<workout-id>.jpg, so the first path segment is the owner and writes
-- are scoped to it. chat_images predates this and has no size or type limit,
-- which is a bucket anyone signed in can fill.

create policy "read workout covers" on storage.objects
  for select using (bucket_id = 'workout_covers');

create policy "write own covers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'workout_covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "update own covers" on storage.objects
  for update to authenticated
  using (bucket_id = 'workout_covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own covers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'workout_covers' and (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================================
-- Still open
-- ============================================================================
--
--   public.meals          RLS disabled. Legacy, 0 rows, nothing reads it.
--                         Enable it with no policies, or drop the table.
--
--   leaked password       A dashboard setting, not SQL: Auth > Policies.
--   protection            Checks new passwords against HaveIBeenPwned.
