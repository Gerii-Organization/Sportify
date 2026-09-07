/**
 * Design tokens — single source for colour, elevation, radius and type.
 *
 * Two rules hold the system together:
 *
 * 1. WARM MEANS REWARD, COOL MEANS ACTION.
 *    Streak, energy and calories live in the warm family. Buttons, progress and
 *    anything tappable are teal. The two never swap. This is what stops a
 *    streak badge from disappearing into an orange button.
 *
 * 2. SEPARATION COMES FROM ELEVATION, NOT BORDERS.
 *    The old palette drew a 1px line around every card — 106 of them. Surfaces
 *    now get lighter as they come forward, the way physical layers do. Borders
 *    are reserved for state (selected, active, danger), where a line means
 *    something.
 */

export const colors = {
  // --- Action / brand -------------------------------------------------
  accent: '#2ED3C6',
  /** Text and icons on top of an accent-filled surface. */
  onAccent: '#00201D',
  accentSoft: 'rgba(46, 211, 198, 0.12)',
  accentBorder: 'rgba(46, 211, 198, 0.38)',
  accentStrong: 'rgba(46, 211, 198, 0.65)',

  // --- Surfaces, back to front ----------------------------------------
  // Neutral, with a trace of the accent's hue rather than a warm cast. The
  // previous ground was brown-black, which fought the teal sitting on it and
  // read as slightly dirty. A deep slate lets the accent stay the only warm-or-
  // cool decision on screen, and keeps the ember glow reading as light rather
  // than as more of the same colour.
  //
  // Each step is lighter than the last. Never put a card on a surface of the
  // same value — the elevation IS the separation.
  background: '#08090C',
  surface: '#15181D',
  card: '#1E222A',
  surfaceRaised: '#282D36',
  surfaceHigh: '#333944',
  sheet: '#171B21',

  // --- Borders --------------------------------------------------------
  // Only for state. A resting card has none.
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.14)',

  // --- Text -----------------------------------------------------------
  // Cool-neutral greys to match the ground. A warm grey on a slate surface
  // looks like a print artefact.
  text: '#F7F8FA',
  textSecondary: '#AEB4BC',
  textMuted: '#8B929B',
  textFaint: '#616872',
  textDisabled: '#454B54',

  // --- Semantic ---------------------------------------------------------
  // Six hues, kept far enough apart on the wheel that no two read as the same
  // thing at a glance. Activity stays mint rather than returning to light
  // blue: with the streak back on orange there is room for it, but two blues
  // plus a periwinkle and a violet was already crowded.
  //
  // Orange and gold are the only warm colours, and both mean "earned" —
  // streak and currency. Everything measured stays cool.
  streak: '#FF8A2B',
  energy: '#FFD84A',
  calories: '#2ED3C6',

  water: '#4FB8E8',
  sleep: '#7C8CF0',
  activity: '#3FDCA6',
  xp: '#7C8CF0',

  danger: '#FF6B5A',
  success: '#5FD98A',
};

/** Avatar ring colour per level bracket. */
export const levelTiers = [
  { minLevel: 40, color: '#FF6BD6', borderWidth: 3, glow: true },
  { minLevel: 30, color: '#6FD6FF', borderWidth: 3, glow: true },
  { minLevel: 20, color: '#FFC93C', borderWidth: 2, glow: false },
  { minLevel: 10, color: '#C9BFB5', borderWidth: 2, glow: false },
  { minLevel: 5, color: '#CD7F32', borderWidth: 2, glow: false },
];

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
  sheet: 32,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 40,
};

/**
 * Type scale. Headings run tight and heavy; labels run wide and small.
 * Sticking to these six sizes is what makes a screen feel composed rather
 * than assembled.
 */
export const type = {
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 15, fontWeight: '400' },
  metric: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  caption: { fontSize: 12, fontWeight: '400' },
};

/**
 * Elevation presets. Use these instead of hand-writing background + border.
 * `pressed` is what a tappable surface becomes while held.
 */
export const elevation = {
  flat: { backgroundColor: colors.surface },
  card: { backgroundColor: colors.card },
  raised: { backgroundColor: colors.surfaceRaised },
  high: { backgroundColor: colors.surfaceHigh },
  pressed: { backgroundColor: colors.surfaceHigh, opacity: 0.9 },
};

export const gradients = {
  /** Screen ground. Almost flat — the atmosphere comes from AmbientGlow. */
  screen: ['#141920', '#07080B'],
  /** Chat and other content-dense screens: completely flat. */
  flat: ['#0F1216', '#08090C'],
  /** The sunrise halo. Only behind hero figures, never behind numbers. */
  ember: ['#FFB03A', '#E0490A', 'rgba(200, 40, 0, 0)'],
  /** Accent wash for the primary button and active states. */
  accent: ['#3FE3D4', '#22B5AA'],
};

/** The floating tab bar is 62pt tall with a 16pt margin; lists must clear it. */
export const TAB_BAR_CLEARANCE = 110;

export default { colors, levelTiers, radius, spacing, type, elevation, gradients, TAB_BAR_CLEARANCE };
