-- Replies, reactions, and a hole in the message policy.
--
-- THE HOLE FIRST. `edit own messages` is:
--
--   for update using (sender_id = auth.uid() or receiver_id = auth.uid())
--
-- The receiver is in there because that is how `is_read` gets set. But RLS
-- cannot restrict WHICH columns an update touches, so the same permission lets
-- the person you are talking to rewrite what you said — and the message would
-- show as yours, unedited, to both of you. A trigger is the only way to bound
-- it, because a policy cannot see the difference between two updates.

begin;

alter table public.messages
  add column if not exists reply_to  uuid references public.messages(id) on delete set null,
  add column if not exists reactions jsonb not null default '{}'::jsonb;

create index if not exists messages_reply_to_idx on public.messages (reply_to);

/**
 * A receiver may mark a message read. That is all they may do.
 *
 * Reactions go through toggle_reaction below, which is SECURITY DEFINER and so
 * is not subject to this trigger's caller check.
 */
create or replace function public.messages_guard_receiver_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.sender_id then
    return new;
  end if;

  if auth.uid() = old.receiver_id then
    -- Everything except is_read has to be identical to what was there.
    if new.content     is distinct from old.content
    or new.image_url   is distinct from old.image_url
    or new.is_deleted  is distinct from old.is_deleted
    or new.is_edited   is distinct from old.is_edited
    or new.reply_to    is distinct from old.reply_to
    or new.reactions   is distinct from old.reactions
    or new.sender_id   is distinct from old.sender_id
    or new.receiver_id is distinct from old.receiver_id then
      raise exception 'only the sender can change a message';
    end if;
    return new;
  end if;

  raise exception 'not your message';
end;
$$;

drop trigger if exists messages_guard_receiver on public.messages;
create trigger messages_guard_receiver
  before update on public.messages
  for each row execute function public.messages_guard_receiver_update();

/**
 * Adds or removes one emoji reaction, and returns the whole map.
 *
 * `reactions` is `{"❤️": ["user-id", ...]}` — the ids rather than a count, so
 * the client can show whether YOU reacted without a second table, and so a
 * double tap cannot count twice.
 *
 * A function because the trigger above (correctly) stops a receiver touching
 * the column directly. SECURITY DEFINER runs as the owner and is not the
 * caller the trigger is checking.
 */
create or replace function public.toggle_reaction(p_message_id uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  current  jsonb;
  holders  jsonb;
  msg      public.messages%rowtype;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if p_emoji is null or length(p_emoji) > 8 then
    return jsonb_build_object('ok', false, 'reason', 'bad_emoji');
  end if;

  select * into msg from public.messages where id = p_message_id;

  if msg.id is null or (msg.sender_id <> me and msg.receiver_id <> me) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  current := coalesce(msg.reactions, '{}'::jsonb);
  holders := coalesce(current -> p_emoji, '[]'::jsonb);

  if holders ? me::text then
    holders := (select coalesce(jsonb_agg(v), '[]'::jsonb)
                  from jsonb_array_elements_text(holders) v
                 where v <> me::text);
  else
    holders := holders || to_jsonb(me::text);
  end if;

  -- An emoji nobody holds is removed rather than left as an empty list, so the
  -- client can render the keys without filtering.
  if jsonb_array_length(holders) = 0 then
    current := current - p_emoji;
  else
    current := jsonb_set(current, array[p_emoji], holders, true);
  end if;

  update public.messages set reactions = current where id = p_message_id;

  return jsonb_build_object('ok', true, 'reactions', current);
end;
$$;

revoke all on function public.toggle_reaction(uuid, text) from public;
revoke all on function public.messages_guard_receiver_update() from public;
grant execute on function public.toggle_reaction(uuid, text) to authenticated;

commit;
