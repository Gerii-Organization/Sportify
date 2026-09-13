import { View, Text, StyleSheet } from 'react-native';
import { Play, Trash2, Bookmark, Copy, Pencil, Globe, Lock, Type } from 'lucide-react-native';
import { colors } from '../theme';
import Press from './Press';
import { musclesOf, exerciseCount, estimateMinutes, estimateKcal } from '../lib/workoutStats';

/**
 * One routine, in every list that shows one.
 *
 * Name, then the three numbers you weigh before starting — exercises, minutes,
 * kcal — then what it trains as tags. The round button on the right is always
 * the primary action; anything secondary sits as small pills under the tags,
 * so the corner the thumb reaches for never changes meaning between lists.
 *
 * `variant` decides the secondary actions, not the layout:
 *   mine    none — or visibility, rename and delete while `editing`
 *   browse  save for later, copy into your own list
 *   saved   unsave
 *
 * `highlight` is the card at the top of the list: brighter edge and a filled
 * button, so the next thing to do is the most obvious thing on screen.
 * `popular` is the plan you clearly run most (or, elsewhere, the most saved).
 */
export default function WorkoutCard({
  workout,
  variant = 'mine',
  editing = false,
  highlight = false,
  popular = false,
  weightKg,
  onOpen,
  onDelete,
  onRename,
  onToggleVisibility,
  onCopy,
  onToggleSave,
}) {
  const name = workout.name || 'Untitled';
  const count = exerciseCount(workout);
  const minutes = estimateMinutes(workout);
  const kcal = estimateKcal(workout, weightKg);
  const canEdit = variant === 'mine' && editing;
  const saved = !!workout.is_saved;
  const saves = Number(workout.save_count) || 0;

  const meta = [
    count ? `${count} exercise${count === 1 ? '' : 's'}` : 'No exercises yet',
    minutes ? `${minutes} min` : null,
    kcal ? `${kcal} kcal` : null,
  ].filter(Boolean);

  const tags = [...musclesOf(workout).slice(0, 2), workout.intensity].filter(Boolean);

  // Someone else's plan says whose it is before anything else: that decides
  // whether it is worth opening.
  const byline = variant === 'mine'
    ? null
    : [
        workout.is_mine ? 'Yours' : workout.author_name ? `by ${workout.author_name}` : null,
        saves > 0 ? `${saves} saved` : null,
      ].filter(Boolean).join('  ·  ');

  return (
    <Press
      scale={0.985}
      onPress={onOpen}
      style={[styles.card, highlight && styles.cardOn]}
      accessibilityLabel={`Open ${name}, ${meta.join(', ')}`}
    >
      <View style={[styles.edge, highlight && styles.edgeOn]} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {popular ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>POPULAR</Text>
            </View>
          ) : null}
        </View>

        {byline ? <Text style={styles.byline} numberOfLines={1}>{byline}</Text> : null}

        <Text style={styles.meta} numberOfLines={1}>
          {meta.map((part, i) => (
            <Text key={part}>
              {i > 0 ? <Text style={styles.sep}>{'   •   '}</Text> : null}
              {part}
            </Text>
          ))}
        </Text>

        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {canEdit ? (
          <View style={styles.actions}>
            {/* Visibility belongs with the list, not inside the workout: it is
                a decision about which of your plans other people can see, and
                that is a question you ask while looking at all of them. */}
            <Action
              icon={workout.is_public ? Globe : Lock}
              label={workout.is_public ? 'Public' : 'Private'}
              tint={workout.is_public ? colors.accent : colors.textMuted}
              onPress={onToggleVisibility}
              accessibilityLabel={workout.is_public ? `Make ${name} private` : `Share ${name} publicly`}
            />
            <Action icon={Type} label="Rename" onPress={onRename} accessibilityLabel={`Rename ${name}`} />
            <Action icon={Trash2} label="Delete" tint={colors.danger} onPress={onDelete} accessibilityLabel={`Delete ${name}`} />
          </View>
        ) : variant !== 'mine' ? (
          <View style={styles.actions}>
            <Action
              icon={Bookmark}
              filled={saved}
              label={saved ? 'Saved' : 'Save'}
              tint={saved ? colors.accent : colors.textMuted}
              onPress={onToggleSave}
              selected={saved}
              accessibilityLabel={saved ? `Remove ${name} from saved` : `Save ${name}`}
            />
            {!workout.is_mine ? (
              <Action icon={Copy} label="Copy" tint={colors.accent} onPress={onCopy} accessibilityLabel={`Copy ${name} into my workouts`} />
            ) : null}
          </View>
        ) : null}
      </View>

      <Press
        scale={0.9}
        style={[styles.go, highlight && styles.goOn]}
        onPress={onOpen}
        accessibilityLabel={canEdit ? `Edit ${name}` : `Start ${name}`}
      >
        {canEdit ? (
          <Pencil color={colors.accent} size={18} />
        ) : (
          <Play
            color={highlight ? colors.onAccent : colors.accent}
            fill={highlight ? colors.onAccent : colors.accent}
            size={17}
            // The triangle's visual centre sits left of its box.
            style={{ marginLeft: 3 }}
          />
        )}
      </Press>
    </Press>
  );
}

function Action({ icon: Icon, label, tint = colors.textSecondary, filled = false, selected, onPress, accessibilityLabel }) {
  return (
    <Press
      scale={0.94}
      style={styles.action}
      onPress={onPress}
      hitSlop={4}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      <Icon color={tint} fill={filled ? tint : 'transparent'} size={14} />
      <Text style={[styles.actionText, { color: tint }]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: 20,
    paddingLeft: 26,
    paddingRight: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardOn: { borderColor: 'rgba(155, 157, 214, 0.2)' },

  // Inset from top and bottom rather than full height: a full-height stripe
  // reads as a status colour, a floating one as a bookmark in a page.
  edge: {
    position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 5,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
    backgroundColor: 'rgba(155, 157, 214, 0.55)',
  },
  edgeOn: { backgroundColor: colors.accent },

  body: { flex: 1, marginRight: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3, flexShrink: 1 },
  badge: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: colors.accentBorder,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { color: colors.calories, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  byline: { color: colors.textFaint, fontSize: 12, marginTop: 4 },

  meta: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
  sep: { color: colors.textDisabled },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  tagText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
  },
  actionText: { fontSize: 12, fontWeight: '600' },

  go: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1, borderColor: 'rgba(155, 157, 214, 0.3)',
  },
  goOn: {
    backgroundColor: colors.accent, borderColor: colors.accent,
    shadowColor: colors.accent, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
