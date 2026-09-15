-- Close two reward functions any signed-in account could call directly.
--
--   award_xp(xp_delta, energy_delta)  adds whatever XP and energy it is given
--   grant_streak_freeze()             adds a Streak Freeze, uncapped
--
-- Both are SECURITY DEFINER and were executable by `authenticated`, so
--   POST /rest/v1/rpc/award_xp {"xp_delta": 1000000, "energy_delta": 1000000}
-- bought the whole shop and topped the leaderboard. The shop's server-side
-- price check (20260916_purchase_item_server_price) meant nothing while energy
-- itself could be minted.
--
-- Neither is called by the app any more (rewards come from complete_workout,
-- claim_daily_reward and claim_streak_milestones, which decide the amounts on
-- the server) and no database function calls them, so nothing legitimate
-- loses access. The functions are kept rather than dropped so an older build
-- that still references them gets a permission error instead of a missing
-- function, and so the definitions stay readable.

revoke all on function public.award_xp(integer, integer) from public, anon, authenticated;
revoke all on function public.grant_streak_freeze() from public, anon, authenticated;
