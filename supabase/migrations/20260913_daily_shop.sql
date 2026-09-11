-- The shop catalogue, and a daily rotation with discounts.
--
-- TWO THINGS ARE WRONG TODAY AND THIS FIXES THE FIRST.
--
-- 1. The catalogue lives only in the client, in src/constants/cosmetics.js.
--    The server has never known what anything costs, which is why
--    `purchase_item` takes `p_price` as an argument — from the client. Any
--    signed-in user can therefore name their own price.
--
-- 2. Because of that, a discount cannot be enforced. The rotation below
--    computes the real price; `purchase_item` still has to be changed to read
--    it instead of believing the client. See the note at the bottom.
--
-- The rotation is derived from the date rather than stored, so there is no cron
-- job, no rows to write at midnight, and every user sees the same three items
-- all day without any of them having to be first.

begin;

create table if not exists public.shop_items (
  id     text primary key,
  type   text not null check (type in ('ring', 'avatar', 'badge', 'title', 'powerup')),
  name   text not null,
  price  integer not null check (price >= 0)
);

alter table public.shop_items enable row level security;

drop policy if exists "shop items are readable" on public.shop_items;
create policy "shop items are readable" on public.shop_items
  for select to authenticated using (true);

-- Seeded from src/constants/cosmetics.js. Re-run this insert after adding an
-- item there, or the new one can never appear in the daily shop.
insert into public.shop_items (id, type, name, price) values
  ('r1', 'ring', 'Standard Flow', 0),
  ('r2', 'ring', 'Hellfire Ring', 800),
  ('r3', 'ring', 'Cyber Hex', 1200),
  ('r4', 'ring', 'Toxic Triangle', 1500),
  ('r5', 'ring', 'Neon Pulse', 2000),
  ('r6', 'ring', 'Golden Diamond', 2500),
  ('r7', 'ring', 'Quantum Core', 3500),
  ('a1', 'avatar', 'Clean Cut', 0),
  ('a2', 'avatar', 'Golden King', 1500),
  ('a3', 'avatar', 'Demon Aura', 2000),
  ('a4', 'avatar', 'Electric Glitch', 2500),
  ('a5', 'avatar', 'Holographic', 3000),
  ('a6', 'avatar', 'Hellfire', 3500),
  ('a7', 'avatar', 'The Void', 5000),
  ('b1', 'badge', 'Rookie', 0),
  ('b2', 'badge', 'Spartan', 1000),
  ('b3', 'badge', 'Phantom', 3000),
  ('b4', 'badge', 'Overlord', 5000),
  ('Gym Rat', 'title', 'Gym Rat', 100),
  ('Beast Mode', 'title', 'Beast Mode', 250),
  ('Iron Lifter', 'title', 'Iron Lifter', 500),
  ('Olympian', 'title', 'Olympian', 1000),
  ('p3', 'powerup', 'Coin Boost', 50),
  ('p4', 'powerup', 'Streak Freeze', 400),
  ('p1', 'powerup', 'XP Boost', 600),
  ('p2', 'powerup', 'Streak Restore', 1000)
on conflict (id) do update
  set type = excluded.type, name = excluded.name, price = excluded.price;

/** Today's three discounted items. Free and already-cheap items are left out. */
create or replace function public.daily_shop_ids()
returns table (id text)
language sql
stable
set search_path = public
as $$
  select s.id
  from public.shop_items s
  where s.price >= 100
  order by abs(hashtext(s.id || '|' || (now() at time zone 'utc')::date::text))
  limit 3;
$$;

/**
 * The discount on one item today, as a percentage. 0 when it is not on offer.
 *
 * Deterministic from the date and the id: the same for everyone, stable all
 * day, and different tomorrow. A random() here would reshuffle on every call —
 * the bug the daily spin had, where restarting the app re-rolled the prize.
 */
create or replace function public.daily_discount(p_item_id text)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_item_id in (select id from public.daily_shop_ids())
    -- 20, 30 or 40 percent, picked the same way the items are.
    then 20 + 10 * (abs(hashtext(p_item_id || '|d|' || (now() at time zone 'utc')::date::text)) % 3)
    else 0
  end;
$$;

/**
 * Today's shop: the items, their normal price, and what they cost today.
 *
 * `owned` is here so the client does not have to cross-reference the rotation
 * against the inventory itself and get it wrong for titles, which are kept on
 * the profile rather than in user_inventory.
 */
create or replace function public.get_daily_shop()
returns table (
  id       text,
  type     text,
  name     text,
  price    integer,
  discount integer,
  final_price integer,
  owned    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.type,
    s.name,
    s.price,
    public.daily_discount(s.id) as discount,
    -- Rounded to whole energy, and never free: a 100% path would be a way to
    -- take a 5,000 item for nothing if the percentages ever changed.
    greatest(1, s.price - (s.price * public.daily_discount(s.id)) / 100) as final_price,
    (
      s.id in (select item_id from public.user_inventory where user_id = auth.uid())
      or (s.type = 'title' and s.id = any(
            coalesce((select owned_titles from public.profiles where id = auth.uid()), array[]::text[])
         ))
    ) as owned
  from public.shop_items s
  where s.id in (select id from public.daily_shop_ids());
$$;

revoke all on function public.daily_discount(text) from public;
revoke all on function public.daily_shop_ids() from public;
revoke all on function public.get_daily_shop() from public;
grant execute on function public.daily_discount(text) to authenticated;
grant execute on function public.daily_shop_ids() to authenticated;
grant execute on function public.get_daily_shop() to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- STILL TO DO, BY HAND, AND IT MATTERS.
--
-- `purchase_item(p_item_id, p_item_type, p_price)` charges whatever the client
-- sends. Until it is changed, the discount above is decoration and the price
-- is whatever a modified client says it is. Inside that function, replace the
-- use of p_price with:
--
--   select greatest(1, price - (price * public.daily_discount(id)) / 100)
--     into charged
--     from public.shop_items
--    where id = p_item_id;
--
--   if charged is null then
--     return jsonb_build_object('ok', false, 'reason', 'unknown_item');
--   end if;
--
-- and keep p_price only to compare against `charged`, refusing the purchase
-- when they disagree — that turns a silent overcharge into an error the client
-- can report.
-- ---------------------------------------------------------------------------
