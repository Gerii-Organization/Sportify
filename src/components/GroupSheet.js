import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { LogOut, Trash2, Check, Pencil } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';

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
export default function GroupSheet({ visible, onClose, group, currentUserId, onChanged }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group?.name ?? '');

  const isOwner = group?.created_by === currentUserId;

  const load = useCallback(async () => {
    if (!group?.id) return;
    setLoading(true);

    const { data: rows } = await supabase
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', group.id);

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
    const next = name.trim();
    if (!next) return Alert.alert('Name required', 'Give the group a name.');
    if (next === group.name) return setRenaming(false);

    const { error } = await supabase.from('groups').update({ name: next }).eq('id', group.id);
    if (error) return Alert.alert('Could not rename', error.message);

    setRenaming(false);
    onChanged?.();
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave group',
      isOwner
        ? 'You created this group. Leaving does not delete it — the conversation stays for everyone else.'
        : 'You will stop receiving messages from this group.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('group_members')
              .delete()
              .eq('group_id', group.id)
              .eq('user_id', currentUserId);

            if (error) return Alert.alert('Could not leave', error.message);
            onClose();
            onChanged?.();
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete group',
      `"${group.name}" and every message in it will be removed for all ${members.length} members. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('groups').delete().eq('id', group.id);
            if (error) return Alert.alert('Could not delete', error.message);
            onClose();
            onChanged?.();
          },
        },
      ]
    );
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
            onSubmitEditing={handleRename}
          />
          <TouchableOpacity activeOpacity={0.7} style={styles.confirm} onPress={handleRename} accessibilityLabel="Save name">
            <Check color={colors.onAccent} size={20} />
          </TouchableOpacity>
        </View>
      ) : (
        isOwner && (
          <TouchableOpacity activeOpacity={0.7} style={styles.renameHint} onPress={() => setRenaming(true)}>
            <Pencil color={colors.textSecondary} size={14} />
            <Text style={styles.renameHintText}>Rename group</Text>
          </TouchableOpacity>
        )
      )}

      <Text style={styles.sectionLabel}>
        {loading ? 'Members' : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
      ) : (
        <View style={styles.list}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <Avatar profile={member} size={38} />
              <Text style={styles.memberName}>
                {member.first_name}
                {member.id === currentUserId ? ' (you)' : ''}
              </Text>
              {member.id === group?.created_by && <Text style={styles.ownerTag}>Owner</Text>}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.dangerRow} onPress={handleLeave} activeOpacity={0.7}>
        <LogOut color={colors.danger} size={18} />
        <Text style={styles.dangerText}>Leave group</Text>
      </TouchableOpacity>

      {isOwner && (
        <TouchableOpacity style={styles.dangerRow} onPress={handleDelete} activeOpacity={0.7}>
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
