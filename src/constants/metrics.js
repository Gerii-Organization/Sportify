import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { recentDayKeys, todayKey, startOfTodayIso, formatDuration } from '../lib/date';
import { WATER_GOAL_ML } from './content';

/**
 * Everything that differs between the four daily metrics.
 *
 * The detail screens share one layout — hero arc, seven-day chart, a strip of
 * derived figures, and a list of entries — so the screens are one file. Only
 * the queries, units and wording change, and those live here.
 *
 * Each `load()` returns:
 *   raw      today's numeric value, for the arc
 *   value    the same figure formatted for display
 *   goal     the target, or null when the metric genuinely has none
 *   series   seven { key, value } points, oldest first
 *   stats    two or three derived figures worth knowing
 *   entries  individual records, newest first
 */

/** Local calendar day for a timestamp. */
const dayOf = (ts) => todayKey(new Date(ts));

const WEEK_AGO = () => new Date(Date.now() - 6 * 86400000).toISOString();

/**
 * Groups rows into the last seven local days.
 *
 * The previous version grouped with `toISOString()`, which is UTC. A meal
 * logged at 22:00 in Bucharest counted against the following day, so the bar
 * chart disagreed with the total shown above it. `recentDayKeys` has always
 * been local, so only one side had to move.
 */
function toSeries(rows, tsField, valueOf) {
  const days = recentDayKeys(7);
  const totals = Object.fromEntries(days.map((d) => [d, 0]));

  (rows || []).forEach((row) => {
    const key = dayOf(row[tsField]);
    if (key in totals) totals[key] += valueOf(row);
  });

  return days.map((key) => ({ key, value: totals[key] }));
}

/** Mean over the days that actually have data, not over all seven. */
function meanOfLogged(series) {
  const logged = series.filter((p) => p.value > 0);
  if (!logged.length) return 0;
  return logged.reduce((t, p) => t + p.value, 0) / logged.length;
}

const best = (series) => series.reduce((m, p) => Math.max(m, p.value), 0);

/** Grams, or a dash when the figure was never recorded. */
const grams = (v) => (v > 0 ? `${Math.round(v)}g` : '—');
const daysHitting = (series, goal) => (goal ? series.filter((p) => p.value >= goal).length : 0);

export const METRICS = {
  calories: {
    title: 'Calories',
    color: colors.calories,
    icon: 'Flame',
    unit: 'kcal',
    chartLabel: 'Eaten per day',
    listLabel: 'Today',
    emptyText: 'Nothing logged yet. Scan a meal to start.',
    goalNote: 'Target comes from your weight, height, age and goal.',

    async load(userId, profile, calorieTarget) {
      const [{ data: today }, { data: week }] = await Promise.all([
        supabase
          .from('scanned_foods')
          .select('id, food_name, calories, protein, carbs, fats, emoji, scanned_at')
          .eq('user_id', userId)
          .gte('scanned_at', startOfTodayIso())
          .order('scanned_at', { ascending: false }),
        supabase
          .from('scanned_foods')
          .select('calories, scanned_at')
          .eq('user_id', userId)
          .gte('scanned_at', WEEK_AGO()),
      ]);

      const meals = today || [];
      const raw = meals.reduce((t, m) => t + (Number(m.calories) || 0), 0);
      const series = toSeries(week, 'scanned_at', (r) => Number(r.calories) || 0);

      // Macro split matters more here than a day average: it is the number that
      // changes what you eat next, and it is already stored per meal.
      const macros = meals.reduce(
        (t, m) => ({
          protein: t.protein + (Number(m.protein) || 0),
          carbs: t.carbs + (Number(m.carbs) || 0),
          fats: t.fats + (Number(m.fats) || 0),
        }),
        { protein: 0, carbs: 0, fats: 0 }
      );

      return {
        raw,
        value: Math.round(raw).toLocaleString(),
        goal: calorieTarget,
        series,
        // A zero macro total almost always means the field was never recorded
        // rather than that the meal genuinely had none of it — `carbs` was only
        // added to the scanner recently, so older entries have nothing there.
        // Showing a dash is honest; showing "0g" is a claim about the food.
        stats: [
          { label: 'Protein', value: grams(macros.protein) },
          { label: 'Carbs', value: grams(macros.carbs) },
          { label: 'Fats', value: grams(macros.fats) },
          { label: '7-day avg', value: Math.round(meanOfLogged(series)).toLocaleString() },
        ],
        entries: meals.map((row) => ({
          id: row.id,
          title: row.food_name,
          badge: row.emoji || '🍽️',
          right: `${Math.round(row.calories)} kcal`,
          sub: [
            row.protein ? `P ${Math.round(row.protein)}g` : null,
            row.carbs ? `C ${Math.round(row.carbs)}g` : null,
            row.fats ? `F ${Math.round(row.fats)}g` : null,
          ].filter(Boolean).join('   '),
          at: row.scanned_at,
        })),
      };
    },
  },

  activity: {
    title: 'Active minutes',
    color: colors.activity,
    icon: 'Clock',
    unit: 'min',
    chartLabel: 'Minutes per day',
    listLabel: "Today's sessions",
    emptyText: 'No workouts today.',
    goalNote: 'Sixty minutes is the general daily recommendation.',

    async load(userId) {
      const days = recentDayKeys(7);

      const [{ data: today }, { data: week }, { data: steps }] = await Promise.all([
        supabase
          .from('workout_completions')
          .select('id, workout_name, duration_minutes, completed_at')
          .eq('user_id', userId)
          .gte('completed_at', startOfTodayIso())
          .order('completed_at', { ascending: false }),
        // daily_stats is the canonical per-day total — complete_workout writes
        // it using the device's timezone, so it already agrees with the chart.
        supabase
          .from('daily_stats')
          .select('date, activity_minutes')
          .eq('user_id', userId)
          .in('date', days),
        supabase
          .from('daily_steps')
          .select('record_date, step_count')
          .eq('user_id', userId)
          .in('record_date', days),
      ]);

      const sessions = today || [];
      const byDay = Object.fromEntries((week || []).map((r) => [r.date, Number(r.activity_minutes) || 0]));
      const series = days.map((key) => ({ key, value: byDay[key] || 0 }));

      const raw = byDay[todayKey()] ?? sessions.reduce((t, w) => t + (Number(w.duration_minutes) || 0), 0);

      const stepTotal = (steps || []).reduce((t, r) => t + (Number(r.step_count) || 0), 0);
      const stepsToday = (steps || []).find((r) => r.record_date === todayKey())?.step_count || 0;

      return {
        raw,
        value: String(Math.round(raw)),
        goal: 60,
        series,
        stats: [
          { label: 'Sessions today', value: String(sessions.length) },
          { label: 'Steps today', value: Number(stepsToday).toLocaleString() },
          { label: 'Steps this week', value: stepTotal.toLocaleString() },
          { label: 'Week total', value: `${Math.round(series.reduce((t, p) => t + p.value, 0))} min` },
        ],
        entries: sessions.map((row) => ({
          id: row.id,
          title: row.workout_name,
          badge: '🏋️',
          right: `${row.duration_minutes} min`,
          sub: '',
          at: row.completed_at,
        })),
      };
    },
  },

  water: {
    title: 'Water',
    color: colors.water,
    icon: 'Droplets',
    unit: 'L',
    chartLabel: 'Litres per day',
    listLabel: 'This week',
    emptyText: 'Nothing logged yet.',
    goalNote: 'Two and a half litres is a common daily target.',

    async load(userId) {
      const days = recentDayKeys(7);
      const { data } = await supabase
        .from('daily_stats')
        .select('date, water_ml')
        .eq('user_id', userId)
        .in('date', days);

      const byDay = Object.fromEntries((data || []).map((r) => [r.date, Number(r.water_ml) || 0]));
      const raw = (byDay[todayKey()] || 0) / 1000;
      const series = days.map((key) => ({ key, value: (byDay[key] || 0) / 1000 }));

      return {
        raw,
        value: raw.toFixed(1),
        goal: WATER_GOAL_ML / 1000,
        series,
        stats: [
          { label: '7-day avg', value: `${meanOfLogged(series).toFixed(1)} L` },
          { label: 'Best day', value: `${best(series).toFixed(1)} L` },
          { label: 'Goal hit', value: `${daysHitting(series, WATER_GOAL_ML / 1000)} of 7` },
        ],
        // There is no per-glass record, only a daily total, so the list is the
        // week rather than individual entries.
        entries: days
          .slice()
          .reverse()
          .filter((key) => byDay[key])
          .map((key) => ({
            id: key,
            title: key === todayKey() ? 'Today' : labelFor(key),
            badge: '💧',
            right: `${((byDay[key] || 0) / 1000).toFixed(1)} L`,
            sub: byDay[key] >= WATER_GOAL_ML ? 'Goal reached' : '',
            at: null,
          })),
      };
    },
  },

  sleep: {
    title: 'Sleep',
    color: colors.sleep,
    icon: 'Moon',
    unit: '',
    chartLabel: 'Hours per night',
    listLabel: 'Last seven nights',
    emptyText: 'No sleep data. This is read from Apple Health on iOS.',
    goalNote: 'Read from Apple Health. The dial runs to 12 hours — it is a scale, not a target.',

    async load(userId) {
      const days = recentDayKeys(7);
      const { data } = await supabase
        .from('daily_stats')
        .select('date, sleep_minutes')
        .eq('user_id', userId)
        .in('date', days);

      const byDay = Object.fromEntries((data || []).map((r) => [r.date, Number(r.sleep_minutes) || 0]));
      const raw = (byDay[todayKey()] || 0) / 60;
      const series = days.map((key) => ({ key, value: (byDay[key] || 0) / 60 }));

      const logged = series.filter((p) => p.value > 0);
      const avgMinutes = logged.length
        ? Math.round((logged.reduce((t, p) => t + p.value, 0) / logged.length) * 60)
        : 0;

      return {
        raw,
        value: formatDuration(byDay[todayKey()] || 0),
        // Not a goal — sleep need varies by person and the app should not tell
        // anyone what theirs is. `scaleMax` only sets how far round the dial a
        // night travels, and the caption says so.
        goal: null,
        scaleMax: 12,
        series,
        stats: [
          { label: 'Nightly avg', value: logged.length ? formatDuration(avgMinutes) : '—' },
          { label: 'Longest', value: logged.length ? formatDuration(Math.round(best(series) * 60)) : '—' },
          { label: 'Nights logged', value: `${logged.length} of 7` },
        ],
        entries: days
          .slice()
          .reverse()
          .filter((key) => byDay[key])
          .map((key) => ({
            id: key,
            title: key === todayKey() ? 'Last night' : labelFor(key),
            badge: '🌙',
            right: formatDuration(byDay[key]),
            sub: '',
            at: null,
          })),
      };
    },
  },
};

/** "Mon 3 Mar" from a YYYY-MM-DD key, parsed as a local date. */
function labelFor(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
