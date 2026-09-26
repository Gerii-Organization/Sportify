-- Friend challenges are removed from the app (decided 2026-09-22).
--
-- Undoes 20260918_challenges.sql: its five functions, then both tables (the
-- policies and index go with them). Both tables were empty when this ran, so
-- nothing is lost; the earlier file still documents how it worked.

begin;

drop function if exists public.get_my_challenges();
drop function if exists public.settle_my_challenges();
drop function if exists public.respond_challenge(uuid, boolean);
drop function if exists public.create_challenge(text, text, int, uuid[]);
drop function if exists public.challenge_score(uuid, text, timestamptz, timestamptz);

drop table if exists public.challenge_participants;
drop table if exists public.challenges;

-- Used by the policies above, so it can only go once the tables have.
drop function if exists public.in_challenge(uuid);

commit;
