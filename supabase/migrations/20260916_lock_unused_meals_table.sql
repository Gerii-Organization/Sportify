-- `public.meals` had row level security switched off.
--
-- The security advisor rated it an error: with RLS off, the anon key alone
-- could read, insert, update and delete every row through /rest/v1/meals. The
-- table is a leftover — the app logs food in `scanned_foods` and never reads
-- this one, and it held no rows when this ran.
--
-- RLS on with no policies closes it to every API role. Nothing is dropped, so
-- if the table turns out to be wanted, it only needs policies added.

alter table public.meals enable row level security;
