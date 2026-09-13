-- Purchases charge the server's price, never the client's.
--
-- `purchase_item(p_item_id, p_item_type, p_price)` has always charged whatever
-- `p_price` the app sent. A modified client could send 1 and take a 5,000
-- energy avatar, and the daily-shop discounts were decoration for the same
-- reason: nothing on the server knew what anything cost.
--
-- 20260913_daily_shop.sql put the catalogue in `shop_items` and the discount in
-- `daily_discount()`. This migration makes the purchase read them.
--
-- HOW: the existing function is renamed, not rewritten. Everything it does
-- today — the balance check under a row lock, the deduction, the inventory
-- row, the power-up effects — keeps running unchanged, under a name clients can
-- no longer call. A new `purchase_item` with the same signature and return
-- type works out the real price and passes that on.
--
-- The client's `p_price` is still accepted, but only compared. When it
-- disagrees with the server (a stale screen across midnight UTC, when the
-- daily discounts change, or a tampered request) nothing is charged and the
-- app is told the price changed, rather than being silently charged a
-- different amount from the one it showed.
--
-- Depends on 20260913_daily_shop.sql.

begin;

do $$
begin
  if to_regclass('public.shop_items') is null
     or to_regprocedure('public.daily_discount(text)') is null then
    raise exception 'shop_items / daily_discount are missing. Apply 20260913_daily_shop.sql first.';
  end if;

  if to_regprocedure('public.purchase_item_unchecked(text, text, integer)') is not null then
    raise exception 'purchase_item_unchecked already exists: this migration has already been applied.';
  end if;

  if to_regprocedure('public.purchase_item(text, text, integer)') is null then
    raise exception 'public.purchase_item(text, text, integer) does not exist; there is nothing to wrap.';
  end if;
end $$;

alter function public.purchase_item(text, text, integer) rename to purchase_item_unchecked;

-- Renaming keeps the old grants, which include `authenticated`. Without this
-- revoke the whole point is lost: a client would call the unchecked name.
revoke all on function public.purchase_item_unchecked(text, text, integer) from public, anon, authenticated;

create function public.purchase_item(p_item_id text, p_item_type text, p_price integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type    text;
  v_list    integer;
  v_charged integer;
begin
  select s.type, s.price
    into v_type, v_list
    from public.shop_items s
   where s.id = p_item_id;

  -- Unknown ids and a type that does not match the catalogue are the same
  -- answer: this is not something the shop sells.
  if v_type is null or v_type <> p_item_type then
    return json_build_object('ok', false, 'reason', 'unknown_item');
  end if;

  -- Same formula as get_daily_shop(): rounded down to whole energy, and never
  -- free for an item that has a price.
  v_charged := case
    when v_list = 0 then 0
    else greatest(1, v_list - (v_list * public.daily_discount(p_item_id)) / 100)
  end;

  if p_price is distinct from v_charged then
    return json_build_object('ok', false, 'reason', 'price_changed', 'price', v_charged);
  end if;

  return public.purchase_item_unchecked(p_item_id, v_type, v_charged);
end;
$$;

revoke all on function public.purchase_item(text, text, integer) from public;
grant execute on function public.purchase_item(text, text, integer) to authenticated;

commit;
