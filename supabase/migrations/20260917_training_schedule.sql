-- Week plan (roadmap T5): which routine on which weekday.
--
-- Seven entries, Monday first, each a routine id as text or null for a rest
-- day. Kept on the profile beside `split`, which it complements — the split is
-- the order of training days, this is the calendar they land on. Shape is
-- checked here so a malformed write fails instead of confusing every screen
-- that reads it (see src/lib/schedule.js).
--
-- The column joins the list the app may write in 20260917_lock_profile_columns.

alter table public.profiles
  add column if not exists training_schedule jsonb;

alter table public.profiles
  drop constraint if exists profiles_training_schedule_shape;

alter table public.profiles
  add constraint profiles_training_schedule_shape check (
    training_schedule is null
    or (jsonb_typeof(training_schedule) = 'array' and jsonb_array_length(training_schedule) = 7)
  );

grant update (training_schedule) on public.profiles to authenticated;
