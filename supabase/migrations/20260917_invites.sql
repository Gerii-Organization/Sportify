-- Invite a friend (roadmap S3).
--
-- Every profile gets a short invite code. Someone signing up with it is linked
-- to the inviter, and both earn energy — but only once the new account has
-- finished a real workout (10 minutes or more). Paying at sign-up would pay
-- for throwaway accounts made in a minute; paying at the first workout pays
-- for a new person who actually trains.
--
-- Guards, all on the server:
--   · a code can't be your own, and an account redeems one code, once
--   · redeeming only works in the first 14 days of an account, so an old
--     account can't be "invited" retroactively for the bonus
--   · the inviter is paid for at most 25 friends; past that the friend still
--     gets their bonus
--
-- Codes use an alphabet without look-alikes (no 0/O, 1/I/L), so one read out
-- loud or typed from a screenshot comes through right.

-- SECURITY DEFINER so the uniqueness loop sees every profile's code rather
-- than only the caller's own row, and EXECUTE stays with `authenticated`: a
-- column default runs with the inserting role's privileges, so revoking it
-- would break every sign-up. It only ever returns a fresh random string.
create or replace function public.new_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..7 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end;
$$;

revoke all on function public.new_invite_code() from public, anon;
grant execute on function public.new_invite_code() to authenticated;

alter table public.profiles add column if not exists invite_code text;

update public.profiles set invite_code = public.new_invite_code() where invite_code is null;

alter table public.profiles alter column invite_code set default public.new_invite_code();

create unique index if not exists profiles_invite_code_key on public.profiles (invite_code);

create table if not exists public.referrals (
  invitee_id  uuid primary key references auth.users (id) on delete cascade,
  inviter_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz,
  invitee_energy int not null default 0,
  inviter_energy int not null default 0,
  check (invitee_id <> inviter_id)
);

create index if not exists referrals_inviter on public.referrals (inviter_id);

alter table public.referrals enable row level security;

drop policy if exists "See referrals you are part of" on public.referrals;
create policy "See referrals you are part of"
  on public.referrals for select
  to authenticated
  using (invitee_id = (select auth.uid()) or inviter_id = (select auth.uid()));

revoke insert, update, delete on public.referrals from anon, authenticated;

create or replace function public.redeem_invite(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := auth.uid();
  code    text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  inviter uuid;
begin
  if me is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  if code = '' then
    return json_build_object('ok', false, 'reason', 'unknown_code');
  end if;

  select id into inviter from public.profiles where invite_code = code;
  if inviter is null then
    return json_build_object('ok', false, 'reason', 'unknown_code');
  end if;
  if inviter = me then
    return json_build_object('ok', false, 'reason', 'own_code');
  end if;

  if exists (select 1 from public.referrals where invitee_id = me) then
    return json_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  if (select created_at from auth.users where id = me) < now() - interval '14 days' then
    return json_build_object('ok', false, 'reason', 'too_late');
  end if;

  insert into public.referrals (invitee_id, inviter_id) values (me, inviter)
  on conflict (invitee_id) do nothing;

  return json_build_object(
    'ok', true,
    'inviter_name', (select first_name from public.profiles where id = inviter)
  );
end;
$$;

create or replace function public.claim_referral_reward()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  ref      public.referrals;
  bonus    constant int := 250;
  paid_to_inviter int := 0;
begin
  if me is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select * into ref from public.referrals where invitee_id = me and rewarded_at is null for update;
  if not found then
    return json_build_object('ok', false, 'reason', 'nothing_to_claim');
  end if;

  if not exists (
    select 1 from public.workout_completions where user_id = me and duration_minutes >= 10
  ) then
    return json_build_object('ok', false, 'reason', 'no_workout_yet');
  end if;

  if (select count(*) from public.referrals where inviter_id = ref.inviter_id and rewarded_at is not null) < 25 then
    paid_to_inviter := bonus;
    update public.profiles set energy_points = coalesce(energy_points, 0) + bonus where id = ref.inviter_id;
  end if;

  update public.profiles set energy_points = coalesce(energy_points, 0) + bonus where id = me;

  update public.referrals
     set rewarded_at = now(), invitee_energy = bonus, inviter_energy = paid_to_inviter
   where invitee_id = me;

  return json_build_object('ok', true, 'energy', bonus,
                           'inviter_name', (select first_name from public.profiles where id = ref.inviter_id));
end;
$$;

-- The inviter's side: how many friends joined, and how many have trained.
create or replace function public.get_invite_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'code', (select invite_code from public.profiles where id = auth.uid()),
    'joined', (select count(*) from public.referrals where inviter_id = auth.uid()),
    'rewarded', (select count(*) from public.referrals where inviter_id = auth.uid() and rewarded_at is not null),
    'energy', (select coalesce(sum(inviter_energy), 0) from public.referrals where inviter_id = auth.uid())
  )
  where auth.uid() is not null;
$$;

revoke all on function public.redeem_invite(text) from public, anon;
revoke all on function public.claim_referral_reward() from public, anon;
revoke all on function public.get_invite_stats() from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.claim_referral_reward() to authenticated;
grant execute on function public.get_invite_stats() to authenticated;
