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
  // Each step is lighter than the last. Never put a card on a surface of the
  // same value — the elevation IS the separation.
  background: '#0A0806',
  surface: '#12100D',
  card: '#17130F',
  surfaceRaised: '#1E1913',
  surfaceHigh: '#25201A',
  sheet: '#1A1611',

  // --- Borders --------------------------------------------------------
  // Only for state. A resting card has none.
  border: 'rgba(255, 255, 255, 0.07)',
  borderLight: 'rgba(255, 255, 255, 0.12)',

  // --- Text -----------------------------------------------------------
  // Warm-biased greys. A neutral grey on a warm ground reads as dirty.
  text: '#FAF7F3',
  textSecondary: '#A89A8C',
  textMuted: '#8A7E72',
  textFaint: '#5E554D',
  textDisabled: '#463F39',

  // --- Semantic: rewards live in the warm family ----------------------
  streak: '#FF8A2B',
  energy: '#FFC93C',
  calories: '#FF7043',

  // --- Semantic: measurements stay cool -------------------------------
  water: '#8FA0FF',
  sleep: '#B49BFF',
  activity: '#6FD6FF',
  xp: '#8FA0FF',

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
  screen: ['#0A0806', '#0E0B08'],
  /** Chat and other content-dense screens: completely flat. */
  flat: ['#0A0806', '#0A0806'],
  /** The sunrise halo. Only behind hero figures, never behind numbers. */
  ember: ['#FFB03A', '#E0490A', 'rgba(200, 40, 0, 0)'],
  /** Accent wash for the primary button and active states. */
  accent: ['#3FE3D4', '#22B5AA'],
};

/** The floating tab bar is 62pt tall with a 16pt margin; lists must clear it. */
export const TAB_BAR_CLEARANCE = 110;

export default { colors, levelTiers, radius, spacing, type, elevation, gradients, TAB_BAR_CLEARANCE };
