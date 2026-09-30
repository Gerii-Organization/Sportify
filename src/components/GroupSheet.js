import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LogOut, Trash2, Check, Pencil, ChevronRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';
import { useConfirm } from './ConfirmDialog';
import { SkeletonMembers } from './Skeleton';

/**
 * Group settings — members, renaming, leaving, deleting.
 *
 * Until now a group could be created and then never touched again: no way to
 * see who was in it, no way to get out, no way to fix a typo in the name. The
 * screen had a chat and nothing else.
 *
 * Permissions follow the row-level policies rather than being invented here:
 * only the creator may rename or delete, anyone may leave. Doing the check in
 * the UI as well keeps destructive buttons from appearing to people who would
 * only get an error if they pressed them.
 */
/** Same limit as when the group is created. */
const NAME_MAX = 40;
const TRY_AGAIN = 'Check your connection and try again.';

export default function GroupSheet({ visible, onClose, group, currentUserId, onChanged }) {
  const confirmAction = useConfirm();
  const navigation = useNavigation();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  /** A rename, leave or delete on its way; the buttons wait for it. */
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(group?.name ?? '');

  const isOwner = group?.created_by === currentUserId;

  const load = useCallback(async () => {
    if (!group?.id) return;
    setLoading(true);
    setFailed(false);

    const { data: rows, error } = await supabase
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', group.id);

    if (error) {
      // An empty list read as "0 members" — and the delete warning then said
      // messages would go "for all 0 members".
      setFailed(true);
      setLoading(false);
      return;
    }

    const ids = (rows || []).map((r) => r.user_id);
    if (ids.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, first_name, xp, equipped_avatar')
      .in('id', ids);

    // Owner first, then everyone else alphabetically — a stable order beats
    // whatever the database happens to return.
    const sorted = (profiles || []).sort((a, b) => {
      if (a.id === group.created_by) return -1;
      if (b.id === group.created_by) return 1;
      return (a.first_name || '').localeCompare(b.first_name || '');
    });

    setMembers(sorted);
    setLoading(false);
  }, [group?.id, group?.created_by]);

  useEffect(() => {
    if (visible) {
      setName(group?.name ?? '');
      setRenaming(false);
      load();
    }
  }, [visible, group?.name, load]);

  const handleRename = async () => {
    // Return and the tick both submit; the second used to send it twice.
    if (busy) return;
    const next = name.trim();
    if (!next) return Alert.alert('Name required', 'Give the group a name.');
    if (next === group.name) return setRenaming(false);

    setBusy(true);
    const { error } = await supabase.from('groups').update({ name: next }).eq('id', group.id);
    setBusy(false);
    if (error) return Alert.alert('Could not rename the group', TRY_AGAIN);

    setRenaming(false);
    onChanged?.('renamed');
  };

  /** A member's profile, from the list. The sheet closes on the way. */
  const openMember = (member) => {
    onClose();
    navigation.navigate('PublicProfileScreen', { userId: member.id });
  };

  const handleLeave = async () => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: LogOut,
      title: `Leave ${group?.name || 'this group'}?`,
      // The owner leaving used to be told only that the group carries on. It
      // does, but nobody is left who can rename or delete it.
      message: isOwner
        ? 'The group stays for the other members, but nobody will be able to rename or delete it. To close it for everyone, delete it instead.'
        : 'You will stop getting messages from this group.',
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
    });
    if (!ok || busy) return;

    setBusy(true);
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('user_id', currentUserId);
    setBusy(false);

    if (error) return Alert.alert('Could not leave the group', TRY_AGAIN);
    onClose();
    onChanged?.('left');
  };

  const handleDelete = async () => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: Trash2,
      title: `Delete ${group?.name || 'this group'}?`,
      message: members.length > 1
        ? `The group and its messages will be deleted for all ${members.length} members. This cannot be undone.`
        : 'The group and its messages will be deleted. This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok || busy) return;

    setBusy(true);
    const { error } = await supabase.from('groups').delete().eq('id', group.id);
    setBusy(false);
    if (error) return Alert.alert('Could not delete the group', TRY_AGAIN);
    onClose();
    onChanged?.('deleted');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={renaming ? 'Rename group' : group?.name}>
      {renaming ? (
        <View style={styles.renameRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="Group name"
            placeholderTextColor={colors.textFaint}
            maxLength={NAME_MAX}
            returnKeyType="done"
            onSubmitEditing={handleRename}
          />
          <TouchableOpacity activeOpacity={0.7} style={styles.confirm} onPress={handleRename} disabled={busy} accessibilityLabel="Save name">
            {busy ? <ActivityIndicator color={colors.onAccent} /> : <Check color={colors.onAccent} size={20} />}
          </TouchableOpacity>
        </View>
      ) : (
        isOwner && (
          <TouchableOpacity activeOpacity={0.7} style={styles.renameHint} onPress={() => setRenaming(true)} hitSlop={{ top: 10, bottom: 10 }} accessibilityRole="button">
            <Pencil color={colors.textSecondary} size={14} />
            <Text style={styles.renameHintText}>Rename group</Text>
          </TouchableOpacity>
        )
      )}

      <Text style={styles.sectionLabel}>
        {loading || failed ? 'Members' : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
      </Text>

      {loading ? (
        <SkeletonMembers count={4} />
      ) : failed ? (
        <View style={styles.failed}>
          <Text style={styles.failedText}>Members could not be loaded.</Text>
          <TouchableOpacity onPress={load} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.retry}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {members.map((member) => {
            const isMe = member.id === currentUserId;
            const isOwnerRow = member.id === group?.created_by;
            // Your own row is not a button: there is nowhere for it to go.
            const Row = isMe ? View : TouchableOpacity;
            const touch = isMe
              ? { accessible: true }
              : { activeOpacity: 0.7, onPress: () => openMember(member), accessibilityRole: 'button' };
            return (
              <Row
                key={member.id}
                style={styles.memberRow}
                {...touch}
                accessibilityLabel={`${member.first_name || 'Member'}${isMe ? ', you' : ''}${isOwnerRow ? ', owner' : ''}`}
              >
                <Avatar profile={member} size={38} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {member.first_name || 'Member'}
                  {isMe ? ' (you)' : ''}
                </Text>
                {isOwnerRow && <Text style={styles.ownerTag}>Owner</Text>}
                {!isMe && <ChevronRight color={colors.textFaint} size={18} />}
              </Row>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.dangerRow} onPress={handleLeave} activeOpacity={0.7} disabled={busy} accessibilityRole="button">
        <LogOut color={colors.danger} size={18} />
        <Text style={styles.dangerText}>Leave group</Text>
      </TouchableOpacity>

      {isOwner && (
        <TouchableOpacity style={styles.dangerRow} onPress={handleDelete} activeOpacity={0.7} disabled={busy} accessibilityRole="button">
          <Trash2 color={colors.danger} size={18} />
          <Text style={styles.dangerText}>Delete group</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  renameRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 15,
  },
  confirm: {
    width: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  renameHintText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.xs, marginBottom: spacing.md },
  failed: { alignItems: 'center', marginBottom: spacing.md },
  failedText: { color: colors.textMuted, fontSize: 14 },
  retry: { color: colors.accent, fontSize: 14, fontWeight: '700', padding: spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  memberName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  ownerTag: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
