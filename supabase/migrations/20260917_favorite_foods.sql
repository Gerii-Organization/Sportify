-- Favourite foods (roadmap N3).
--
-- The meals someone eats most are the ones they should never have to scan
-- again. A favourite is a saved copy of the numbers — name, calories, macros —
-- not a pointer to a scan, so deleting old history does not take a favourite
-- with it, and logging it again inserts a fresh scanned_foods row for today.
--
-- One favourite per name per person, case-insensitively: starring "Oatmeal"
-- twice is the same favourite, and the unique index makes the app's toggle an
-- upsert-or-delete rather than a read-then-write race.
--
-- "Recent" needs no table: it is the latest scanned_foods row per name.

create table if not exists public.favorite_foods (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_name  text not null check (char_length(btrim(food_name)) between 1 and 120),
  calories   int not null default 0 check (calories >= 0),
  protein    numeric not null default 0 check (protein >= 0),
  carbs      numeric not null default 0 check (carbs >= 0),
  fats       numeric not null default 0 check (fats >= 0),
  emoji      text,
  created_at timestamptz not null default now()
);

create unique index if not exists favorite_foods_user_name
  on public.favorite_foods (user_id, lower(food_name));

alter table public.favorite_foods enable row level security;

drop policy if exists "Own favourite foods" on public.favorite_foods;
create policy "Own favourite foods"
  on public.favorite_foods for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.favorite_foods from anon;

-- Recents and the history list both read newest-first per user.
create index if not exists scanned_foods_user_time
  on public.scanned_foods (user_id, scanned_at desc);
