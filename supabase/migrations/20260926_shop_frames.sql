-- Five new avatar frames for energy, and two that energy cannot buy.
--
-- The new frames (a8–a12) are ordinary catalogue items: priced in energy,
-- bought through purchase_item like everything else, and eligible for the
-- daily discounts.
--
-- Golden Apex (a13) and Phoenix (a14) come only in real-money offers, which
-- are not switched on yet. They still need rows here, and a flag, because of
-- how ownership is decided:
--
--   owns_cosmetic() treats anything the catalogue does not sell for energy as
--   free — that is how the default frame, ring and badge stay equippable. An
--   exclusive frame with no row, or with price 0 and no flag, would therefore
--   be equippable by anyone who knew its id.
--
-- `iap_only` closes that: such an item is owned only when it is in the
-- inventory, and purchase_item refuses to sell it for energy. The grant will
-- come from the purchase flow once real-money offers exist.

begin;

alter table public.shop_items
  add column if not exists iap_only boolean not null default false;

insert into public.shop_items (id, type, name, price, iap_only) values
  ('a8',  'avatar', 'Circuit',     1200, false),
  ('a9',  'avatar', 'Sakura',      1600, false),
  ('a10', 'avatar', 'Frostbite',   2200, false),
  ('a11', 'avatar', 'Laurel',      2800, false),
  ('a12', 'avatar', 'Aurora',      3800, false),
  ('a13', 'avatar', 'Golden Apex', 0,    true),
  ('a14', 'avatar', 'Phoenix',     0,    true)
on conflict (id) do update
  set type = excluded.type, name = excluded.name, price = excluded.price, iap_only = excluded.iap_only;

-- Unchanged except for the iap_only branch, which comes before the "not sold,
-- so free" rule it would otherwise fall into.
create or replace function public.owns_cosmetic(p_item text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_item is null then true
    when exists (select 1 from public.season_titles t where t.title = p_item)
      then coalesce((select p.owned_titles ? p_item from public.profiles p where p.id = auth.uid()), false)
    when exists (select 1 from public.shop_items s where s.id = p_item and s.iap_only)
      then exists (select 1 from public.user_inventory i where i.user_id = auth.uid() and i.item_id = p_item)
    when not exists (select 1 from public.shop_items s where s.id = p_item and s.price > 0) then true
    when exists (select 1 from public.shop_items s where s.id = p_item and s.type = 'title')
      then coalesce((select p.owned_titles ? p_item from public.profiles p where p.id = auth.uid()), false)
    else exists (select 1 from public.user_inventory i where i.user_id = auth.uid() and i.item_id = p_item)
  end;
$$;

-- Unchanged except that an iap_only item is refused before any price maths:
-- at price 0 it would otherwise be handed out for free.
create or replace function public.purchase_item(p_item_id text, p_item_type text, p_price integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type     text;
  v_list     integer;
  v_iap_only boolean;
  v_charged  integer;
begin
  select s.type, s.price, s.iap_only
    into v_type, v_list, v_iap_only
    from public.shop_items s
   where s.id = p_item_id;

  if v_type is null or v_type <> p_item_type then
    return json_build_object('ok', false, 'reason', 'unknown_item');
  end if;

  if v_iap_only then
    return json_build_object('ok', false, 'reason', 'not_for_energy');
  end if;

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

revoke all on function public.purchase_item(text, text, integer) from public, anon;
grant execute on function public.purchase_item(text, text, integer) to authenticated;

-- daily_shop_ids() already skips anything under 100 energy, which leaves the
-- price-0 exclusives out of the rotation without a change.

commit;
