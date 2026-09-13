import { createContext, useContext, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation, Easing,
} from 'react-native-reanimated';
import { colors } from '../theme';

/**
 * Loading placeholders shaped like the screen that is about to appear.
 *
 * A spinner says only that something is happening. A skeleton says what is
 * arriving and roughly how much of it, so nothing jumps when the data lands.
 * Every preset below copies the dimensions of the real component it stands in
 * for — card radius, avatar size, row padding — so the swap from placeholder
 * to content reads as the content filling in, not as the layout rearranging.
 *
 * THE SHEEN. One clock per skeleton, shared by every bone in it through
 * context, so a screen shimmers as one surface rather than forty independent
 * pulses. It runs on the UI thread: a JS thread busy with the fetch the
 * skeleton is waiting on cannot stutter it.
 */

const Clock = createContext(null);
const SHEEN = ['rgba(200, 202, 238, 0)', 'rgba(200, 202, 238, 0.08)', 'rgba(200, 202, 238, 0)'];
const range = (n) => Array.from({ length: n }, (_, i) => i);
const pick = (list, i) => list[i % list.length];

export function SkeletonGroup({ children, style }) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
    return () => cancelAnimation(clock);
  }, [clock]);

  return (
    <Clock.Provider value={clock}>
      <View style={style} accessible accessibilityRole="progressbar" accessibilityLabel="Loading">
        {children}
      </View>
    </Clock.Provider>
  );
}

/** One placeholder shape. Outside a SkeletonGroup it is drawn still. */
export function Bone({ w = '100%', h = 14, r = 7, tint, style }) {
  const clock = useContext(Clock);
  const width = useSharedValue(0);

  // The highlight crosses the bone from fully off its left edge to fully off
  // its right, so the jump back to the start happens where nothing is visible.
  const sheen = useAnimatedStyle(() => {
    const span = width.value;
    const t = clock ? clock.value : 0;
    return { transform: [{ translateX: -span + t * span * 2 }] };
  });

  return (
    <View
      style={[styles.bone, { width: w, height: h, borderRadius: r }, tint ? { backgroundColor: tint } : null, style]}
      onLayout={(e) => { width.value = e.nativeEvent.layout.width; }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, sheen]}>
        <LinearGradient colors={SHEEN} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

// --- Workouts ---------------------------------------------------------------

/** WorkoutCard: edge bar, name, meta line, tags, round play button. */
export function SkeletonRoutines({ count = 4 }) {
  return (
    <SkeletonGroup>
      {range(count).map((i) => (
        <View key={i} style={styles.routine}>
          <View style={[styles.routineEdge, i === 0 && styles.routineEdgeOn]} />
          <View style={styles.flex}>
            <Bone w={pick(['62%', '48%', '70%', '55%'], i)} h={17} r={6} />
            <Bone w="74%" h={12} r={6} style={styles.mt12} />
            <View style={styles.tagRow}>
              <Bone w={72} h={26} r={8} />
              <Bone w={60} h={26} r={8} />
            </View>
          </View>
          <Bone w={48} h={48} r={24} style={styles.ml14} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

// --- Social -----------------------------------------------------------------

/** FeedCard: avatar and name, kind chip, title under the name, actions. */
export function SkeletonFeed({ count = 4 }) {
  return (
    <SkeletonGroup style={styles.pad}>
      {range(count).map((i) => (
        <View key={i} style={styles.feedCard}>
          <View style={styles.rowGap10}>
            <Bone w={40} h={40} r={20} />
            <View style={styles.flex}>
              <Bone w={pick(['58%', '46%'], i)} h={14} />
              <Bone w="24%" h={10} style={styles.mt6} />
            </View>
            <Bone w={32} h={32} r={16} />
          </View>
          <View style={styles.feedBody}>
            <Bone w={pick(['78%', '64%'], i)} h={16} />
            <Bone w="38%" h={12} style={styles.mt8} />
            <View style={styles.feedActions}>
              <Bone w={36} h={16} r={8} />
              <Bone w={36} h={16} r={8} />
              {i % 2 === 0 ? <Bone w={112} h={30} r={15} style={styles.mlAuto} /> : null}
            </View>
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Chats: the groups shelf, then conversation rows. */
export function SkeletonChats({ groups = 3, rows = 5 }) {
  return (
    <SkeletonGroup style={styles.padAll}>
      <Bone w={56} h={10} style={styles.eyebrow} />
      <View style={styles.shelfRow}>
        {range(groups).map((i) => (
          <View key={i} style={styles.groupTile}>
            <Bone w={40} h={40} r={14} />
            <Bone w="80%" h={12} style={styles.mt12} />
            <Bone w="50%" h={12} style={styles.mt6} />
          </View>
        ))}
      </View>
      <Bone w={72} h={10} style={styles.eyebrow} />
      {range(rows).map((i) => (
        <View key={i} style={styles.chatRow}>
          <Bone w={52} h={52} r={26} />
          <View style={styles.flex}>
            <View style={styles.spread}>
              <Bone w={pick(['38%', '30%', '44%', '34%', '40%'], i)} h={15} />
              <Bone w={34} h={10} />
            </View>
            <Bone w={pick(['70%', '56%', '80%', '62%', '48%'], i)} h={12} style={styles.mt8} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Leaderboard rows: rank, avatar, name and title, streak and XP chips. */
export function SkeletonLeaderboard({ count = 7 }) {
  return (
    <SkeletonGroup style={styles.pad}>
      {range(count).map((i) => (
        <View key={i} style={styles.leaderRow}>
          <Bone w={24} h={14} />
          <Bone w={46} h={46} r={23} style={styles.ml12} />
          <View style={[styles.flex, styles.ml12]}>
            <Bone w={pick(['52%', '44%', '60%', '38%'], i)} h={14} />
            <Bone w="64%" h={10} style={styles.mt8} />
          </View>
          <Bone w={40} h={24} r={12} />
          <Bone w={58} h={24} r={12} style={styles.ml6} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Search results in the add-friend sheet. */
export function SkeletonPeople({ count = 3 }) {
  return (
    <SkeletonGroup style={styles.mt16}>
      {range(count).map((i) => (
        <View key={i} style={styles.personRow}>
          <Bone w={40} h={40} r={20} />
          <View style={[styles.flex, styles.ml12]}>
            <Bone w={pick(['40%', '52%', '34%'], i)} h={14} />
            <Bone w="22%" h={10} style={styles.mt8} />
          </View>
          <Bone w={36} h={36} r={18} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

const THREAD = [
  { mine: false, w: '58%', h: 42 },
  { mine: false, w: '40%', h: 42 },
  { mine: true, w: '52%', h: 42 },
  { mine: false, w: '68%', h: 62 },
  { mine: true, w: '36%', h: 42 },
  { mine: true, w: '60%', h: 62 },
  { mine: false, w: '46%', h: 42 },
];

/** A conversation: bubbles on both sides, anchored to the bottom like the real list. */
export function SkeletonMessages({ group = false }) {
  return (
    <SkeletonGroup style={styles.thread}>
      {THREAD.map((m, i) => {
        const startsRun = !m.mine && (i === 0 || THREAD[i - 1].mine);
        return (
          <View key={i} style={[m.mine ? styles.mineWrap : styles.theirsWrap, { width: m.w }]}>
            {group && startsRun ? <Bone w={64} h={10} style={styles.senderBone} /> : null}
            <Bone
              h={m.h}
              r={22}
              tint={m.mine ? 'rgba(155, 157, 214, 0.2)' : undefined}
              style={m.mine ? styles.mineTail : styles.theirsTail}
            />
          </View>
        );
      })}
    </SkeletonGroup>
  );
}

/** Comments in the comment sheet: avatar and a bubble. */
export function SkeletonComments({ count = 3 }) {
  return (
    <SkeletonGroup>
      {range(count).map((i) => (
        <View key={i} style={styles.commentRow}>
          <Bone w={32} h={32} r={16} />
          <View style={styles.commentBubble}>
            <Bone w={pick(['34%', '26%', '40%'], i)} h={11} />
            <Bone w={pick(['86%', '62%', '74%'], i)} h={12} style={styles.mt8} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Group members in the group sheet. */
export function SkeletonMembers({ count = 4 }) {
  return (
    <SkeletonGroup style={styles.mb16}>
      {range(count).map((i) => (
        <View key={i} style={styles.memberRow}>
          <Bone w={38} h={38} r={19} />
          <Bone w={pick(['42%', '30%', '50%', '36%'], i)} h={14} style={styles.ml12} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Someone else's profile: avatar, name, actions, stats, recent sessions. */
export function SkeletonProfile({ top = 80 }) {
  return (
    <SkeletonGroup style={[styles.profile, { paddingTop: top }]}>
      <View style={styles.heroCenter}>
        <Bone w={100} h={100} r={50} />
        <Bone w={150} h={26} r={8} style={styles.mt16} />
        <Bone w={110} h={14} style={styles.mt8} />
        <View style={styles.profileActions}>
          <Bone w="auto" h={50} r={25} style={styles.flex} />
          <Bone w={50} h={50} r={25} />
          <Bone w={50} h={50} r={25} />
        </View>
      </View>
      <View style={styles.profileStats}>
        {range(3).map((i) => (
          <View key={i} style={styles.cell}>
            <Bone w={28} h={28} r={14} />
            <Bone w={46} h={20} r={6} style={styles.mt8} />
            <Bone w={64} h={10} style={styles.mt6} />
          </View>
        ))}
      </View>
      <View style={styles.padH}>
        <Bone w={140} h={18} r={6} style={styles.mb16} />
        {range(3).map((i) => (
          <View key={i} style={[styles.card20, styles.row]}>
            <Bone w={40} h={40} r={12} />
            <View style={[styles.flex, styles.ml12]}>
              <Bone w="54%" h={14} />
              <Bone w="36%" h={11} style={styles.mt8} />
            </View>
            <Bone w={56} h={24} r={12} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

// --- Shop -------------------------------------------------------------------

function SectionBone({ note = false }) {
  return (
    <View style={styles.sectionBone}>
      <View>
        <Bone w={128} h={14} />
        {note ? <Bone w={190} h={11} style={styles.mt8} /> : null}
      </View>
      <Bone w={56} h={12} />
    </View>
  );
}

/** The whole shop: header and wallet, chips, offer, daily reward, deals, boosters. */
export function SkeletonShop() {
  return (
    <SkeletonGroup style={styles.flex}>
      <View style={styles.shopHeader}>
        <Bone w={40} h={40} r={20} />
        <View style={styles.flex}>
          <Bone w={78} h={24} r={8} />
          <Bone w={150} h={12} style={styles.mt10} />
        </View>
        <Bone w={68} h={32} r={16} />
        <Bone w={100} h={32} r={16} style={styles.ml6} />
      </View>

      <View style={styles.shopChips}>
        {[98, 106, 92, 116].map((w) => <Bone key={w} w={w} h={40} r={20} />)}
      </View>

      <View style={styles.padH}>
        <View style={styles.shopHero}>
          <View style={styles.spread}>
            <Bone w={118} h={26} r={13} />
            <Bone w={84} h={26} r={13} />
          </View>
          <View style={[styles.row, styles.mt14]}>
            <View style={styles.flex}>
              <Bone w="70%" h={20} />
              <Bone w="46%" h={20} style={styles.mt6} />
              <Bone w="80%" h={12} style={styles.mt12} />
              <Bone w="60%" h={10} style={styles.mt8} />
            </View>
            <Bone w={104} h={104} r={52} style={styles.ml12} />
          </View>
        </View>

        <SectionBone />
        <View style={styles.shopRow}>
          <Bone w={48} h={48} r={12} />
          <View style={styles.flex}>
            <Bone w="50%" h={15} />
            <Bone w="64%" h={12} style={styles.mt8} />
          </View>
          <Bone w={76} h={38} r={19} />
        </View>
        <View style={styles.dealRow}>
          {range(3).map((i) => (
            <View key={i} style={styles.dealCard}>
              <View style={styles.spread}>
                <Bone w={36} h={18} r={9} />
                <Bone w={30} h={10} />
              </View>
              <Bone w={48} h={48} r={14} style={styles.centerMt12} />
              <Bone w="78%" h={13} style={styles.centerMt10} />
              <Bone w="54%" h={10} style={styles.centerMt6} />
              <Bone h={28} r={14} style={styles.mt12} />
            </View>
          ))}
        </View>

        <SectionBone note />
        {range(2).map((i) => (
          <View key={i} style={[styles.shopRow, styles.mb10]}>
            <Bone w={46} h={46} r={12} />
            <View style={styles.flex}>
              <Bone w={pick(['44%', '52%'], i)} h={15} />
              <Bone w="76%" h={11} style={styles.mt8} />
            </View>
            <Bone w={70} h={32} r={16} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

// --- Progress ---------------------------------------------------------------

function Bars({ heights, height, r = 6, gap = 8 }) {
  return (
    <View style={[styles.bars, { height, gap }]}>
      {heights.map((h, i) => (
        <View key={i} style={styles.barSlot}>
          <Bone h={`${h}%`} r={r} />
        </View>
      ))}
    </View>
  );
}

/** Stats: range toggle, weekly goal, four tiles, a bar chart. */
export function SkeletonStats() {
  return (
    <SkeletonGroup style={styles.pad}>
      <View style={styles.toggleBone}>
        <Bone w="50%" h={36} r={12} />
      </View>
      <View style={styles.card}>
        <View style={styles.spread}>
          <Bone w={120} h={12} />
          <Bone w={64} h={10} />
        </View>
        <View style={[styles.spread, styles.mt14]}>
          {range(7).map((i) => <Bone key={i} w={30} h={30} r={15} />)}
        </View>
      </View>
      <View style={styles.tileGrid}>
        {range(4).map((i) => (
          <View key={i} style={styles.tile}>
            <Bone w={22} h={22} r={11} />
            <Bone w="56%" h={22} style={styles.mt10} />
            <Bone w="66%" h={10} style={styles.mt8} />
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Bone w={130} h={11} />
        <Bars heights={[46, 70, 30, 88, 56, 100, 64]} height={150} />
      </View>
    </SkeletonGroup>
  );
}

/** History: totals strip, a month label, session rows. */
export function SkeletonHistory() {
  return (
    <SkeletonGroup style={styles.pad}>
      <View style={styles.strip}>
        {range(3).map((i) => (
          <View key={i} style={styles.cell}>
            <Bone w={18} h={18} r={9} />
            <Bone w={44} h={18} r={6} style={styles.mt6} />
            <Bone w={52} h={9} style={styles.mt6} />
          </View>
        ))}
      </View>
      <Bone w={90} h={10} style={styles.monthBone} />
      {range(5).map((i) => (
        <View key={i} style={[styles.card20, styles.row]}>
          <View style={styles.flex}>
            <Bone w={pick(['52%', '40%', '60%', '46%', '56%'], i)} h={15} />
            <Bone w="68%" h={11} style={styles.mt8} />
          </View>
          <Bone w={58} h={14} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Records list: intro line, then exercise rows with the best set on the right. */
export function SkeletonRecords() {
  return (
    <SkeletonGroup style={styles.pad}>
      <Bone w="92%" h={11} />
      <Bone w="58%" h={11} style={[styles.mt8, styles.mb16]} />
      {range(6).map((i) => (
        <View key={i} style={[styles.card20, styles.row]}>
          <View style={styles.flex}>
            <Bone w={pick(['58%', '44%', '66%', '50%', '40%', '62%'], i)} h={15} />
            <Bone w="52%" h={11} style={styles.mt8} />
          </View>
          <View style={styles.alignEnd}>
            <Bone w={74} h={15} />
            <Bone w={84} h={10} style={styles.mt6} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** One exercise's progression: best set, 1RM chart, session rows. */
export function SkeletonRecordDetail() {
  return (
    <SkeletonGroup style={styles.pad}>
      <View style={styles.heroCenter}>
        <Bone w={28} h={28} r={14} />
        <Bone w={170} h={34} r={10} style={styles.mt10} />
        <Bone w={130} h={12} style={styles.mt10} />
        <Bone w={112} h={30} r={15} style={styles.mt14} />
      </View>
      <View style={styles.card}>
        <Bone w={150} h={11} />
        <Bars heights={[52, 60, 48, 70, 66, 84, 78, 100]} height={130} r={5} gap={6} />
      </View>
      {range(3).map((i) => (
        <View key={i} style={[styles.card18, styles.row]}>
          <View style={styles.flex}>
            <Bone w="46%" h={14} />
            <Bone w="34%" h={11} style={styles.mt8} />
          </View>
          <Bone w={64} h={14} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** A daily metric: the ring, its caption, the stat strip, the chart. */
export function SkeletonMetric() {
  return (
    <SkeletonGroup style={styles.pad}>
      <View style={styles.heroCenter}>
        <View style={styles.ring}>
          <Bone w={22} h={22} r={11} />
          <Bone w={84} h={32} r={9} style={styles.mt8} />
          <Bone w={44} h={11} style={styles.mt6} />
        </View>
        <Bone w={180} h={14} style={styles.mt16} />
        <Bone w={240} h={11} style={styles.mt8} />
      </View>
      <View style={styles.strip}>
        {range(4).map((i) => (
          <View key={i} style={styles.cell}>
            <Bone w={48} h={16} r={6} />
            <Bone w={40} h={10} style={styles.mt6} />
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Bone w={120} h={11} />
        <Bars heights={[40, 64, 52, 80, 36, 90, 70]} height={120} />
      </View>
    </SkeletonGroup>
  );
}

/** Achievements: the unlocked summary, then rows with a progress track each. */
export function SkeletonAchievements() {
  return (
    <SkeletonGroup style={styles.pad}>
      <View style={styles.card}>
        <Bone w={96} h={24} r={8} />
        <Bone w={64} h={11} style={styles.mt8} />
        <Bone h={8} r={4} style={styles.mt14} />
      </View>
      {range(6).map((i) => (
        <View key={i} style={[styles.card20, styles.rowTop]}>
          <Bone w={46} h={46} r={16} />
          <View style={[styles.flex, styles.ml14]}>
            <Bone w={pick(['48%', '36%', '56%', '42%', '52%', '38%'], i)} h={15} />
            <Bone w="86%" h={11} style={styles.mt8} />
            <Bone h={6} r={3} style={styles.mt12} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** The month grid on the streak screen, day circles only. */
export function SkeletonCalendar({ weeks = 5 }) {
  return (
    <SkeletonGroup>
      {range(weeks).map((w) => (
        <View key={w} style={styles.calendarRow}>
          {range(7).map((d) => (
            <View key={d} style={styles.calendarCell}>
              <Bone w={34} h={34} r={17} />
            </View>
          ))}
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Weight sheet: three readings and the bar chart under them. */
export function SkeletonWeight() {
  return (
    <SkeletonGroup style={styles.mt16}>
      <View style={styles.spreadAround}>
        {range(3).map((i) => (
          <View key={i} style={styles.cell}>
            <Bone w={62} h={17} r={6} />
            <Bone w={48} h={10} style={styles.mt6} />
          </View>
        ))}
      </View>
      <View style={styles.mt20}>
        <Bars heights={[60, 66, 58, 72, 68, 64, 76, 70, 62, 74]} height={110} r={3} gap={6} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  bone: { backgroundColor: colors.surfaceHigh, overflow: 'hidden' },

  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  rowGap10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  spreadAround: { flexDirection: 'row', justifyContent: 'space-around' },
  alignEnd: { alignItems: 'flex-end' },
  cell: { flex: 1, alignItems: 'center' },

  pad: { paddingHorizontal: 20, paddingTop: 4 },
  padAll: { padding: 20 },
  padH: { paddingHorizontal: 20 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  mb10: { marginBottom: 10 },
  mb16: { marginBottom: 16 },
  ml6: { marginLeft: 6 },
  ml12: { marginLeft: 12 },
  ml14: { marginLeft: 14 },
  mlAuto: { marginLeft: 'auto' },
  centerMt6: { alignSelf: 'center', marginTop: 6 },
  centerMt10: { alignSelf: 'center', marginTop: 10 },
  centerMt12: { alignSelf: 'center', marginTop: 12 },

  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 16 },
  card20: { backgroundColor: colors.card, borderRadius: 20, padding: 16, marginBottom: 8 },
  card18: { backgroundColor: colors.card, borderRadius: 18, padding: 14, marginBottom: 6 },
  strip: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 24, paddingVertical: 16, marginBottom: 20 },

  routine: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22,
    paddingVertical: 20, paddingLeft: 26, paddingRight: 18, marginBottom: 12, overflow: 'hidden',
  },
  routineEdge: {
    position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 5,
    borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.surfaceHigh,
  },
  routineEdgeOn: { backgroundColor: 'rgba(155, 157, 214, 0.35)' },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 14 },

  feedCard: { backgroundColor: colors.card, borderRadius: 28, padding: 16, marginBottom: 10 },
  feedBody: { marginTop: 12, marginLeft: 50 },
  feedActions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 16 },

  eyebrow: { marginBottom: 12 },
  shelfRow: { flexDirection: 'row', gap: 10, marginBottom: 26, overflow: 'hidden' },
  groupTile: { width: 112, backgroundColor: colors.card, borderRadius: 20, padding: 14 },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },

  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, padding: 16, borderRadius: 24, marginBottom: 10,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },

  thread: { flex: 1, padding: 16, justifyContent: 'flex-end' },
  mineWrap: { alignSelf: 'flex-end', marginBottom: 10 },
  theirsWrap: { alignSelf: 'flex-start', marginBottom: 10 },
  mineTail: { borderBottomRightRadius: 5 },
  theirsTail: { borderBottomLeftRadius: 5 },
  senderBone: { marginBottom: 6, marginLeft: 4 },

  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  commentBubble: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },

  profile: { flex: 1, paddingTop: 80 },
  heroCenter: { alignItems: 'center', paddingVertical: 20 },
  profileActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', paddingHorizontal: 40, marginTop: 20 },
  profileStats: {
    flexDirection: 'row', backgroundColor: colors.card,
    marginHorizontal: 20, borderRadius: 24, paddingVertical: 20, marginVertical: 24,
  },

  shopHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  shopChips: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 12, overflow: 'hidden' },
  shopHero: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 22, padding: 16, marginTop: 6,
  },
  sectionBone: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  shopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14,
  },
  dealRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dealCard: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 10,
  },

  toggleBone: { backgroundColor: colors.surface, borderRadius: 16, padding: 4, marginBottom: 16 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 22, padding: 16 },
  bars: { flexDirection: 'row', marginTop: 16 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  monthBone: { marginTop: 8, marginBottom: 12 },
  ring: {
    width: 148, height: 148, borderRadius: 74, borderWidth: 9, borderColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },

  calendarRow: { flexDirection: 'row', marginBottom: 6 },
  calendarCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
});
