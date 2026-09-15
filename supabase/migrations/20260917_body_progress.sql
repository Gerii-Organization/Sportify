-- Body measurements and private progress photos (roadmap T6).
--
-- Bodyweight alone hides most of what training changes: two kilos down can be
-- fat lost or muscle lost, and a tape measure and a photo tell them apart.
--
-- Measurements are stored in centimetres whatever the phone shows, one row per
-- day (a second entry the same day corrects the first). Bounds are wide enough
-- for any adult and narrow enough to catch a value typed in the wrong unit.
--
-- Photos are the most private thing the app holds, so the bucket is NOT public:
-- files are reachable only through short-lived signed URLs, created for the
-- owner by the storage policies below. Nobody else — friends, groups, the feed
-- — can list or read them. Paths are `<user id>/<timestamp>.jpg`, and the table
-- refuses a row whose path is not in the owner's own folder.

create table if not exists public.body_measurements (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  waist_cm    numeric check (waist_cm is null or waist_cm between 20 and 300),
  chest_cm    numeric check (chest_cm is null or chest_cm between 30 and 300),
  hips_cm     numeric check (hips_cm  is null or hips_cm  between 30 and 300),
  arm_cm      numeric check (arm_cm   is null or arm_cm   between 10 and 100),
  thigh_cm    numeric check (thigh_cm is null or thigh_cm between 15 and 150),
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table public.body_measurements enable row level security;

drop policy if exists "Own measurements" on public.body_measurements;
create policy "Own measurements"
  on public.body_measurements for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.body_measurements from anon;

create table if not exists public.progress_photos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path       text not null unique,
  pose       text not null default 'front' check (pose in ('front', 'side', 'back')),
  taken_on   date not null default current_date,
  created_at timestamptz not null default now(),
  constraint progress_photos_own_folder check (split_part(path, '/', 1) = user_id::text)
);

create index if not exists progress_photos_user_taken on public.progress_photos (user_id, taken_on desc);

alter table public.progress_photos enable row level security;

-- Add and remove, never edit: a photo with its date changed is a different photo.
drop policy if exists "Read own photos" on public.progress_photos;
create policy "Read own photos"
  on public.progress_photos for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Add own photos" on public.progress_photos;
create policy "Add own photos"
  on public.progress_photos for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Delete own photos" on public.progress_photos;
create policy "Delete own photos"
  on public.progress_photos for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.progress_photos from anon;
revoke update on public.progress_photos from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress_photos', 'progress_photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "progress photos readable by owner" on storage.objects;
create policy "progress photos readable by owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress_photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress photos added by owner" on storage.objects;
create policy "progress photos added by owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress_photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress photos deleted by owner" on storage.objects;
create policy "progress photos deleted by owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress_photos' and (storage.foldername(name))[1] = auth.uid()::text);
