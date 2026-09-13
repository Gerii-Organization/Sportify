-- Signed-out callers could run every function added since 20260910.
--
-- Each of those migrations did `revoke all ... from public` and then granted
-- `authenticated`. That is not enough on Supabase: the project's default
-- privileges grant EXECUTE on every new function in `public` to `anon`
-- explicitly, and an explicit grant survives a revoke from PUBLIC. The
-- security advisor listed all of them as callable through /rest/v1/rpc with
-- only the anon key.
--
-- Most of them refuse a null auth.uid() anyway, but browse_workouts,
-- get_daily_shop and get_social_counts would have answered.
--
-- The trigger function needs no EXECUTE grant for its trigger to fire, so it is
-- taken away from signed-in callers as well: nothing should call it directly.

begin;

revoke execute on function public.browse_workouts(integer, text, text, text) from anon;
revoke execute on function public.claim_scan(integer) from anon;
revoke execute on function public.create_post(text) from anon;
revoke execute on function public.get_daily_shop() from anon;
revoke execute on function public.get_social_counts(uuid) from anon;
revoke execute on function public.is_group_member(uuid, uuid) from anon;
revoke execute on function public.is_group_owner(uuid, uuid) from anon;
revoke execute on function public.purchase_item(text, text, integer) from anon;
revoke execute on function public.toggle_follow(uuid) from anon;
revoke execute on function public.toggle_reaction(uuid, text) from anon;
revoke execute on function public.daily_discount(text) from anon;
revoke execute on function public.daily_shop_ids() from anon;
revoke execute on function public.messages_guard_receiver_update() from anon, authenticated;

commit;
