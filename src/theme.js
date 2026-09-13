/**
 * Design tokens — single source for colour, elevation, radius and type.
 *
 * Palette: NOCTURNE RITUAL. Obsidian canvases with desaturated periwinkle
 * accents, in place of the slate-and-teal it replaced. The brief is explicit
 * that it "rejects high-saturation neon gamification" — nothing here is allowed
 * to shout.
 *
 * Three rules hold the system together:
 *
 * 1. WARM MEANS REWARD, COOL MEANS ACTION.
 *    Streak, energy and calories live in the warm family. Buttons, progress and
 *    anything tappable are periwinkle. The two never swap. This is what stops a
 *    streak badge from disappearing into a button.
 *
 * 2. SEPARATION COMES FROM ELEVATION, NOT BORDERS.
 *    The old palette drew a 1px line around every card — 106 of them. Surfaces
 *    now get lighter as they come forward, the way physical layers do. Borders
 *    are reserved for state (selected, active, danger), where a line means
 *    something.
 *
 * 3. DESATURATED, BUT STILL SIX DISTINCT HUES.
 *    Nocturne pulls every colour towards lavender, and taken literally that
 *    would make water, sleep, calories and activity read as one thing on the
 *    metric rings. Saturation and luminance follow the palette; the hue spacing
 *    that keeps those four readable at a glance does not.
 */

export const colors = {
  // --- Action / brand -------------------------------------------------
  // Nocturne's primary: soft periwinkle lilac. Carries active progress
  // indicators, ring fills and every focused control.
  accent: '#9B9DD6',
  /** Text and icons on top of an accent-filled surface. */
  onAccent: '#0D0F17',
  accentSoft: 'rgba(155, 157, 214, 0.12)',
  accentBorder: 'rgba(155, 157, 214, 0.38)',
  accentStrong: 'rgba(155, 157, 214, 0.65)',

  // --- Surfaces, back to front ----------------------------------------
  // Obsidian with a midnight-indigo undertone rather than dead black — the
  // palette's stated reason is eye fatigue at dawn and twilight, which is when
  // a training app actually gets opened.
  //
  // Each step is lighter than the last. Never put a card on a surface of the
  // same value — the elevation IS the separation.
  //
  // Taken from the rendered Stitch screens (code.html), not from DESIGN.md's
  // prose. The two disagree by a step: the prose card is #151824, the screens
  // draw #191c28 — and the screens are what the mockups actually look like.
  background: '#11131B',
  /** Inset wells: search fields, chips, anything recessed into a card. */
  surface: '#0E1017',
  card: '#191C28',
  surfaceRaised: '#1E2130',
  surfaceHigh: '#25293D',
  /** Level 2 in the palette: what floats above everything else. */
  sheet: '#1E2130',

  // --- Borders --------------------------------------------------------
  // Only for state. A resting card has none. Tinted with the accent's hue
  // rather than plain white, which is what stops a 1px line reading as a
  // scratch on the obsidian.
  border: 'rgba(155, 157, 214, 0.12)',
  borderLight: 'rgba(155, 157, 214, 0.24)',

  // --- Text -----------------------------------------------------------
  // Greys carrying the same indigo cast as the ground. A neutral grey on this
  // canvas reads slightly green, the way a warm grey read as a print artefact
  // on the slate before it.
  //
  // The palette names three steps; a five-step ramp is what the screens
  // already use, so the two middles are interpolated rather than invented.
  text: '#F0F1F8',
  textSecondary: '#C7C5D0',
  textMuted: '#8C90AA',
  textFaint: '#6B6F8A',
  textDisabled: '#4C5067',

  // --- Semantic ---------------------------------------------------------
  // Six hues, kept far enough apart on the wheel that no two read as the same
  // thing at a glance — see rule 3 at the top. Every one of them has been
  // pulled down in saturation to sit inside Nocturne without glowing.
  //
  // Warm still means "earned": streak and currency are the only two, now as
  // terracotta and antique gold rather than neon orange and school-bus yellow.
  // Everything measured stays cool.
  streak: '#E0A17A',
  /** Champagne — the shop mockup's own gold, so a bolt reads the same everywhere. */
  energy: '#DEB866',
  calories: '#C8CAEE',

  // --- Champagne ramp ---------------------------------------------------
  // The shop is the one screen that dresses in gold rather than periwinkle.
  // Five steps so a gradient button, its text and its rim come from one ramp.
  gold: '#DEB866',
  goldLight: '#F5E6BE',
  goldDeep: '#C59D4C',
  goldDim: '#6D5A2D',
  /** Text on a champagne fill. Darker than onAccent: gold is lighter than periwinkle. */
  onGold: '#131520',
  goldSoft: 'rgba(222, 184, 102, 0.12)',
  goldBorder: 'rgba(222, 184, 102, 0.35)',

  water: '#8FB8D9',
  sleep: '#A9A4D4',
  activity: '#8FC7B5',
  xp: '#B6B8F0',

  // The palette's own error colour. Success has no counterpart in it, so it
  // takes the botanical sage the brief keeps referring to.
  danger: '#FFB4AB',
  success: '#9FC6A9',
};

/**
 * Avatar ring colour per level bracket.
 *
 * Still five distinguishable tiers, still ordered bronze → silver → gold →
 * rare → legendary, but muted into the palette. A neon pink ring on an
 * obsidian canvas was the loudest thing on any screen it appeared on.
 */
export const levelTiers = [
  { minLevel: 40, name: 'Legend', color: '#D9A8DC', borderWidth: 3, glow: true },
  { minLevel: 30, name: 'Elite', color: '#A3C4DE', borderWidth: 3, glow: true },
  { minLevel: 20, name: 'Gold', color: '#DEB866', borderWidth: 2, glow: false },
  { minLevel: 10, name: 'Silver', color: '#BFBCC9', borderWidth: 2, glow: false },
  { minLevel: 5, name: 'Bronze', color: '#B08968', borderWidth: 2, glow: false },
];

/**
 * Item rarity, lowest to highest.
 *
 * The ladder every loot game uses — grey, green, blue, purple, orange, red —
 * because players already read it without a legend. The hue order is kept;
 * the saturation is pulled down like everything else, since a tag is a label
 * and not a light source.
 *
 * Epic leans further toward violet than the periwinkle accent, and legendary
 * further toward orange than the champagne gold, so neither tag reads as a
 * button or as currency.
 */
export const rarityColors = {
  common: '#A7A9BE',
  uncommon: '#8CC79C',
  rare: '#7FAEE3',
  epic: '#B88AEB',
  legendary: '#E8995A',
  mythic: '#EB7389',
};

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
  screen: ['#161824', '#0E1017'],
  /** Chat and other content-dense screens: completely flat. */
  flat: ['#13151E', '#11131B'],
  /**
   * The halo behind hero figures, never behind numbers.
   *
   * Was a sunrise. Nocturne has no warm light in it, so it is now the same
   * diffuse periwinkle bloom the palette uses for every glow — moonlight
   * rather than dawn.
   */
  ember: ['#B9BBF0', '#6F72AB', 'rgba(111, 114, 171, 0)'],
  /** Accent wash for the primary button and active states. */
  accent: ['#B0B2EA', '#8486C4'],
  /** Champagne satin: the shop's primary buttons, left to right. */
  gold: ['#DEB866', '#C99F4C'],
  /** A card lit from above by something valuable inside it. */
  goldCard: ['#23232E', '#191C28'],
};

/** The floating tab bar is 62pt tall with a 16pt margin; lists must clear it. */
export const TAB_BAR_CLEARANCE = 110;

export default { colors, levelTiers, rarityColors, radius, spacing, type, elevation, gradients, TAB_BAR_CLEARANCE };
