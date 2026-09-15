-- Close the direct writes that forged rewards, and tighten message edits.
--
-- Same shape as 20260917_lock_profile_columns: row-level policies of the form
-- "own rows, ALL commands" let the app insert and update whatever it likes in
-- its own rows. For most tables that is the point. For these it undid the
-- server's rules:
--
--   user_inventory       insert any item_id → every cosmetic free, and the
--                        new ownership check on equipping believes it
--   workout_completions  insert sessions that never happened → weekly quests
--                        claimed without training, feed posts, stats
--   personal_records     insert records → "new record" posts in the feed
--   daily_stats          set water_ml → the water quest, without drinking
--
-- The app only ever READS the first three (writes go through complete_workout,
-- submit_sets and purchase_item, which are SECURITY DEFINER and unaffected), so
-- they become read-only to their owner. daily_stats keeps the two columns the
-- app writes itself — sleep from Health and the day's activity minutes — and
-- loses water_ml, which only add_water may change.
--
-- messages: the UPDATE policy let either side of a conversation update the
-- row, with no check on what changed, so the receiver could rewrite what the
-- sender said. A trigger now enforces who may change what: the author edits
-- or deletes their own words, the receiver only marks them read, nobody moves
-- a message between conversations. Reactions go through toggle_reaction.
--
-- workouts (legacy, unused by the app): the UPDATE policy had no WITH CHECK,
-- so a row could be handed to another user id.

-- user_inventory ------------------------------------------------------------
drop policy if exists "own rows" on public.user_inventory;
drop policy if exists "Read own inventory" on public.user_inventory;
create policy "Read own inventory"
  on public.user_inventory for select
  to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_inventory from anon, authenticated;

-- workout_completions -------------------------------------------------------
drop policy if exists "own rows" on public.workout_completions;
drop policy if exists "Read own sessions" on public.workout_completions;
create policy "Read own sessions"
  on public.workout_completions for select
  to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.workout_completions from anon, authenticated;

-- personal_records ----------------------------------------------------------
drop policy if exists "own rows" on public.personal_records;
drop policy if exists "Read own records" on public.personal_records;
create policy "Read own records"
  on public.personal_records for select
  to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.personal_records from anon, authenticated;

-- daily_stats ---------------------------------------------------------------
-- An upsert from PostgREST writes every column it was sent in both the INSERT
-- and the ON CONFLICT UPDATE, so user_id and date need UPDATE too; the policy's
-- WITH CHECK still pins user_id to the caller.
revoke insert, update on public.daily_stats from anon, authenticated;
grant insert (user_id, date, sleep_minutes, activity_minutes) on public.daily_stats to authenticated;
grant update (user_id, date, sleep_minutes, activity_minutes) on public.daily_stats to authenticated;

-- messages ------------------------------------------------------------------
create or replace function public.guard_message_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  -- Server functions (toggle_reaction, delete_my_account) run as the owner.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.sender_id   is distinct from old.sender_id
  or new.receiver_id is distinct from old.receiver_id
  or new.created_at  is distinct from old.created_at
  or new.reply_to    is distinct from old.reply_to
  or new.reactions   is distinct from old.reactions then
    raise exception 'message_fields_locked' using errcode = '42501';
  end if;

  if me = old.sender_id then
    if new.is_read is distinct from old.is_read then
      raise exception 'only_the_receiver_marks_read' using errcode = '42501';
    end if;
    return new;
  end if;

  if me = old.receiver_id then
    if new.content    is distinct from old.content
    or new.image_url  is distinct from old.image_url
    or new.is_edited  is distinct from old.is_edited
    or new.is_deleted is distinct from old.is_deleted then
      raise exception 'not_your_message' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not_your_message' using errcode = '42501';
end;
$$;

revoke all on function public.guard_message_update() from public, anon, authenticated;

drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- workouts (legacy) ---------------------------------------------------------
alter policy "Update workouts" on public.workouts
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
