import { StyleSheet, Platform } from 'react-native';
import { colors, radius, spacing, TAB_BAR_CLEARANCE } from '../theme';

/**
 * Styles that were previously redeclared in every screen file.
 * `container` alone existed twelve times, `gradientBg` nine, `modalOverlay` five.
 *
 * Screens still keep their own StyleSheet for anything genuinely specific to
 * them — this only holds the shapes that were identical everywhere.
 */
export default StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /** Scroll content that must clear the floating tab bar. */
  scrollContent: { paddingBottom: TAB_BAR_CLEARANCE },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
  },

  /** Row card used for friends, leaderboard entries and chat list items. */
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },

  // --- Modals -------------------------------------------------------------
  /** Dimmed backdrop with the sheet anchored to the bottom. */
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  /** Dimmed backdrop with the dialog centred. */
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },

  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '90%',
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: 32,
    padding: spacing.xl,
    width: '85%',
    alignItems: 'center',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },

  // --- Typography ---------------------------------------------------------
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.sm },
  screenTitle: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: spacing.xs },

  // --- Buttons ------------------------------------------------------------
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: 20,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },

  /** Header padding differs per platform because Android has no safe area inset here. */
  headerTop: { paddingTop: Platform.OS === 'android' ? 40 : 20 },
});
