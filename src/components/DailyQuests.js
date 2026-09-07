import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, Circle, Droplets, Dumbbell, Footprints, Trash2 } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import ProgressArc from './ProgressArc';
import Press from './Press';

/**
 * Today's quests: one ring, rows underneath.
 *
 * The previous version was a flat checklist where every quest carried its own
 * circle, title and progress line. Four of those took as much height as the
 * whole dashboard summary, and none of them answered the only question worth
 * asking at a glance — how much of today is left.
 *
 * The ring answers it. The rows then only have to carry a name and a number,
 * so they shrink to a line each and the section stays short however many
 * quests you add.
 *
 * Water and gym are measured rather than ticked: their rows show progress
 * toward a goal and tapping water opens the log. A manual quest is the only
 * kind you tick yourself.
 */
const ICONS = { water: Droplets, gym: Dumbbell, steps: Footprints };
const TINTS = { water: colors.water, gym: colors.activity, steps: colors.accent };

/** Rows shown before the list collapses behind a "more" line. */
const VISIBLE_LIMIT = 4;

export default function DailyQuests({
  quests,
  isEditMode,
  onPressQuest,
  onSetup,
  onDelete,
}) {
  const [expanded, setExpanded] = useState(false);

  const done = quests.filter((q) => q.done && !q.setup).length;
  const total = quests.filter((q) => !q.setup).length;
  const remaining = total - done;

  const shown = expanded ? quests : quests.slice(0, VISIBLE_LIMIT);
  const hidden = quests.length - shown.length;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.ringWrap}>
          <ProgressArc
            progress={total > 0 ? done / total : 0}
            color={colors.accent}
            size={58}
            strokeWidth={5}
            delay={140}
          />
          <Text style={styles.ringText}>
            {total > 0 ? `${done}/${total}` : '—'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Today's quests</Text>
          <Text style={styles.subtitle}>{summaryFor(total, remaining)}</Text>
        </View>
      </View>

      <View style={styles.rows}>
        {shown.map((quest) => (
          <QuestRow
            key={quest.key}
            quest={quest}
            isEditMode={isEditMode}
            onPress={() => (quest.setup ? onSetup(quest.type) : onPressQuest(quest))}
            onDelete={() => onDelete(quest.id)}
          />
        ))}

        {hidden > 0 && (
          <Press
            scale={0.98}
            onPress={() => setExpanded(true)}
            style={styles.more}
            accessibilityLabel={`Show ${hidden} more quests`}
          >
            <Text style={styles.moreText}>{hidden} more</Text>
          </Press>
        )}
      </View>
    </View>
  );
}

function QuestRow({ quest, isEditMode, onPress, onDelete }) {
  const Icon = ICONS[quest.type] || (quest.done ? CheckCircle2 : Circle);
  const tint = quest.done ? colors.accent : TINTS[quest.type] || colors.textFaint;

  return (
    <View style={styles.row}>
      <Press
        scale={0.99}
        onPress={onPress}
        style={styles.rowMain}
        accessibilityLabel={quest.accessibilityLabel || quest.title}
        accessibilityState={{ checked: !!quest.done }}
      >
        {quest.done && !quest.setup
          ? <CheckCircle2 color={colors.accent} size={19} />
          : <Icon color={tint} size={19} />}

        <Text
          style={[styles.rowTitle, quest.done && styles.rowTitleDone, quest.setup && styles.rowTitleSetup]}
          numberOfLines={1}
        >
          {quest.title}
        </Text>

        {quest.setup ? (
          <Text style={styles.setupHint}>Set up</Text>
        ) : quest.detail ? (
          <Text style={styles.rowDetail}>{quest.detail}</Text>
        ) : null}
      </Press>

      {isEditMode && !quest.setup && (
        <Press
          scale={0.9}
          onPress={onDelete}
          style={styles.deleteBtn}
          accessibilityLabel={`Delete ${quest.title}`}
        >
          <Trash2 color={colors.danger} size={16} />
        </Press>
      )}
    </View>
  );
}

/**
 * The line under the heading.
 *
 * Only the water quest awards XP, so this deliberately does not total one up —
 * a figure that counted quests the app never rewarded would be a made-up number
 * on the most-looked-at screen.
 */
function summaryFor(total, remaining) {
  if (total === 0) return 'Nothing set up yet';
  if (remaining === 0) return 'All done today';
  return `${remaining} left today`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.md,
    marginHorizontal: 20,
    marginBottom: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ringWrap: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  ringText: {
    position: 'absolute',
    color: colors.text, fontSize: 15, fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 3 },

  rows: { marginTop: spacing.md, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  rowTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '500' },
  rowTitleDone: { color: colors.textMuted },
  rowTitleSetup: { color: colors.textSecondary },
  rowDetail: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  setupHint: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 8, marginLeft: 4 },

  more: { paddingVertical: 8 },
  moreText: { color: colors.accent, fontSize: 13, fontWeight: '600', marginLeft: 30 },
});
