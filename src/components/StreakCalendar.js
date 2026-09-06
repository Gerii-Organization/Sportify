import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import BottomSheet from './BottomSheet';
import { deviceTimeZone } from '../lib/date';

/**
 * A month of training days.
 *
 * A streak count on its own is a number you either believe or you don't. Seeing
 * the month filled in is what makes it feel earned — and it also shows the gaps
 * honestly, which a single "12 days" figure hides.
 *
 * Weeks start on Monday. The training week is the unit people plan in, and a
 * Sunday-first grid splits the weekend across two rows.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function StreakCalendar({ visible, onClose }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  /** The month being shown, as an offset in months from today. */
  const month = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d;
  }, [offset]);

  const load = useCallback(async () => {
    setLoading(true);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;

    // The grid below is drawn from local dates, so the server has to group by
    // the same zone. Without this a late-evening session in UTC+2 lands on the
    // previous square and the marks disagree with the streak count.
    const { data: result } = await supabase.rpc('get_streak_calendar', {
      p_month: key,
      p_tz: deviceTimeZone(),
    });

    setData(result);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  useEffect(() => {
    if (visible) setOffset(0);
  }, [visible]);

  const trained = useMemo(() => new Set(data?.days || []), [data]);
  const cells = useMemo(() => buildGrid(month), [month]);

  const todayKeyStr = toKey(new Date());
  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Your streak">
      <View style={styles.stats}>
        <Stat value={data?.current ?? 0} label="Current" tint={colors.streak} icon />
        <Stat value={data?.longest ?? 0} label="Longest" />
        <Stat value={data?.total ?? 0} label="Total days" />
      </View>

      <View style={styles.monthBar}>
        <TouchableOpacity
          onPress={() => setOffset((o) => o - 1)}
          style={styles.monthArrow}
          accessibilityLabel="Previous month"
          activeOpacity={0.7}
        >
          <ChevronLeft color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        <Text style={styles.monthLabel}>{monthLabel}</Text>

        <TouchableOpacity
          onPress={() => setOffset((o) => Math.min(o + 1, 0))}
          style={[styles.monthArrow, offset >= 0 && styles.monthArrowOff]}
          disabled={offset >= 0}
          accessibilityLabel="Next month"
          activeOpacity={0.7}
        >
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>{d}</Text>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
      ) : (
        <View style={styles.grid}>
          {cells.map((date, i) => {
            if (!date) return <View key={`pad-${i}`} style={styles.cell} />;

            const key = toKey(date);
            const didTrain = trained.has(key);
            const isToday = key === todayKeyStr;
            const isFuture = date > new Date();

            return (
              <View key={key} style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    didTrain && styles.dayTrained,
                    isToday && !didTrain && styles.dayToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      didTrain && styles.dayTextTrained,
                      isFuture && styles.dayTextFuture,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.dayTrained]} />
          <Text style={styles.legendText}>Trained</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.dayToday]} />
          <Text style={styles.legendText}>Today</Text>
        </View>
      </View>
    </BottomSheet>
  );
}

function Stat({ value, label, tint, icon }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon && <Flame color={tint || colors.text} size={16} fill={tint || 'transparent'} />}
        <Text style={[styles.statValue, tint && { color: tint }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * The month laid out as a Monday-first grid, padded at the front so the 1st
 * lands under the right weekday.
 */
function buildGrid(month) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  // getDay() is Sunday-based; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;

  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, m, i + 1)),
  ];
}

/** Local calendar key, matching how the server groups completions. */
function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 3 },

  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  monthArrowOff: { opacity: 0.3 },
  monthLabel: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', color: colors.textFaint, fontSize: 11, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Seven per row, so each cell is a seventh of the width.
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayTrained: { backgroundColor: colors.accent },
  dayToday: { borderWidth: 1.5, borderColor: colors.accentBorder },
  dayText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dayTextTrained: { color: colors.onAccent, fontWeight: '700' },
  dayTextFuture: { color: colors.textDisabled },

  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendSwatch: { width: 14, height: 14, borderRadius: 7 },
  legendText: { color: colors.textMuted, fontSize: 12 },
});
