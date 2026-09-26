-- Date of birth instead of a typed age.
--
-- `age` was typed once at sign-up and never changed, so a year later it was
-- wrong everywhere it was used: the calorie target, the heart-rate burn
-- estimate. `birth_date` is stored instead, and the app works the age out from
-- it on the day (src/lib/birthday.js), so it goes up on the birthday.
--
-- `age` stays as a column, kept in step with the date by a trigger on every
-- insert and update: anything that still reads it (older app versions, SQL)
-- gets the age as of the last write. The app also rewrites it when it notices
-- a birthday has passed since (AuthContext), which is what makes the stored
-- value roll over without a scheduled job.
--
-- Profiles made before this have no birth date and keep their typed age until
-- the person adds one.

begin;

alter table public.profiles
  add column if not exists birth_date date;

alter table public.profiles
  drop constraint if exists profiles_birth_date_plausible;
alter table public.profiles
  add constraint profiles_birth_date_plausible
  -- No upper bound here: a CHECK is not re-evaluated as days pass, so one
  -- that reads the clock is a trap. The app refuses future dates.
  check (birth_date is null or birth_date > date '1900-01-01');

create or replace function public.sync_age_from_birth_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_date is not null then
    new.age := extract(year from age(current_date, new.birth_date))::int;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_age_from_birth_date on public.profiles;
create trigger sync_age_from_birth_date
  before insert or update on public.profiles
  for each row execute function public.sync_age_from_birth_date();

-- profiles is locked down per column (20260917_lock_profile_columns.sql), so a
-- new column is unreadable and unwritable until it is named here.
grant select (birth_date), insert (birth_date), update (birth_date) on public.profiles to authenticated;

commit;
