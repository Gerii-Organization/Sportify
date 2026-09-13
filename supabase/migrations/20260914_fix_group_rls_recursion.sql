-- Groups were unreadable, and the error was being swallowed.
--
-- `read members of own groups` was a policy ON group_members whose USING clause
-- SELECTS FROM group_members. Postgres has to evaluate the policy to read the
-- row, and reading the row inside the policy evaluates the policy again:
--
--   infinite recursion detected in policy for relation "group_members"
--
-- `groups` had the mirror of it: its SELECT policy reads group_members, whose
-- policy reads group_members. Every group query in the app failed, and because
-- the client dropped the error and rendered the empty result, it looked like
-- nobody was in any groups rather than like a broken policy.
--
-- The fix is a SECURITY DEFINER function. It runs as its owner, so the read
-- inside it does not re-enter the policy — the recursion is cut at the one
-- point where it starts.

begin;

create or replace function public.is_group_member(
  p_group_id uuid,
  p_user_id  uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

/** Who owns a group, read without re-entering the groups policy. */
create or replace function public.is_group_owner(
  p_group_id uuid,
  p_user_id  uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = p_group_id and created_by = p_user_id
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public;
revoke all on function public.is_group_owner(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;

-- ---- group_members --------------------------------------------------------

drop policy if exists "read members of own groups" on public.group_members;
create policy "read members of own groups" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "add members to own groups" on public.group_members;
create policy "add members to own groups" on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_group_owner(group_id));

drop policy if exists "leave group" on public.group_members;
create policy "leave group" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_group_owner(group_id));

-- ---- groups ---------------------------------------------------------------

drop policy if exists "read own groups" on public.groups;
create policy "read own groups" on public.groups
  for select to authenticated
  using (public.is_group_member(id));

-- ---- group_messages -------------------------------------------------------
-- Same shape, same problem: reading a message checks membership, and the
-- membership read runs the recursive policy.

drop policy if exists "read group messages" on public.group_messages;
create policy "read group messages" on public.group_messages
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "send group messages" on public.group_messages;
create policy "send group messages" on public.group_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_group_member(group_id));

commit;
