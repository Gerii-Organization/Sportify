import { View, Text, Modal, ScrollView, TouchableOpacity, Dimensions, Alert, Linking, StyleSheet } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Timer, Flame, Droplets, Ruler, Shield, HelpCircle, Scale, TrendingUp, LogOut, ChevronRight, Download, Languages } from 'lucide-react-native';
import { colors } from '../../theme';
import { labelForRestChoice } from '../../lib/rest';
import { useT } from '../../i18n';

const SCORING_TEXT =
  'XP: 50 per workout, +20 when you lift over 1000 kg, 30 for hitting your water goal.\n\n' +
  'Energy: 5 per minute trained, up to 500 a session. Spend it in the Shop.\n\n' +
  'Streak: train on consecutive days. Miss one and it resets, unless a streak freeze covers it.';

/** Tapping Language steps through these and wraps. Native names, never translated. */
const LANGUAGE_CYCLE = ['auto', 'en', 'ro'];
const LANGUAGE_NAMES = { en: 'English', ro: 'Română' };
import { PRIVACY_URL, LINKS_CONFIGURED } from '../../constants/links';

const { width } = Dimensions.get('window');

/**
 * The settings drawer.
 *
 * Lifted out of DashboardScreen, which was 1744 lines and held the home screen,
 * this drawer, the profile sheet, the task editor, the step ring and the Health
 * sync in one file. Nothing here is shared with the rest of that screen — none
 * of its twenty-two styles were used anywhere else — so it comes out whole.
 *
 * The prop list is long because a settings drawer genuinely depends on that
 * much: who you are, what you have switched on, and every action it can start.
 * Grouping them into `profile` / `settings` / `actions` would hide the
 * dependency rather than remove it, and hiding it is how a prop goes stale.
 */
export default function SettingsDrawer({
  visible,
  onClose,
  isLoggedIn,
  userProfile,
  level,
  levelXp,
  xpPercentage,
  renderAvatar,
  units,
  setUnits,
  restAlerts,
  streakReminders,
  waterReminders,
  onToggleRestAlerts,
  restSeconds,
  onCycleRestLength,
  onToggleStreakReminders,
  onToggleWaterReminders,
  onOpenProfile,
  onOpenWeight,
  onOpenWater,
  onDeleteAccount,
  onExportData,
  onSignOut,
  onSignIn,
  onOpenProgress,
}) {
  const { t, language, preference, setPreference } = useT();
  const insets = useSafeAreaInsets();
  const nextLanguage = LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(preference) + 1) % LANGUAGE_CYCLE.length];
  /**
   * Rows that need an account. For a guest they were disabled — dimmed and
   * dead to the touch, with no word on why. Now a tap leads to signing in.
   */
  const needsAccount = (action) => (isLoggedIn ? action : () => { onClose(); onSignIn(); });
  return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
          <View style={styles.menuOverlaySide}>
            <TouchableOpacity activeOpacity={0.7} style={styles.menuCloseArea} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
            {/* Slides in from the edge it lives on, rather than fading in over
                the screen like a dialog. */}
            <Animated.View
              entering={SlideInRight.duration(260)}
              style={[styles.sideMenuContent, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) }]}
            >

              {/* The whole profile block is tappable, not just the avatar. */}
              <TouchableOpacity activeOpacity={0.7}
                style={styles.sidebarProfileSection}
                onPress={() => {
                  onClose();
                  if (isLoggedIn) onOpenProfile();
                  else onSignIn();
                }}
                accessibilityRole="button"
                accessibilityHint={isLoggedIn ? 'Opens your profile' : 'Log in or sign up'}
              >
                {renderAvatar(56, 30)}
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text style={styles.sidebarName}>{isLoggedIn ? (userProfile?.first_name || t('User')) : t('Guest')}</Text>

                  {isLoggedIn && userProfile?.equipped_title && (
                     <Text style={{color: colors.accent, fontSize: 13, fontWeight: '600', marginBottom: 6}}>{userProfile.equipped_title}</Text>
                  )}

                  {isLoggedIn ? (
                    <View>
                      <View style={styles.sidebarXpBarBg}>
                        <View style={[styles.sidebarXpBarFill, { width: xpPercentage }]} />
                      </View>
                      <Text style={styles.sidebarXpText}>{t('Lvl {level} • {xp}/100 XP', { level, xp: levelXp })}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.viewProfileSidebar, { color: colors.textSecondary }]}>{t('Not logged in')}</Text>
                  )}
                </View>
                <ChevronRight color={colors.textFaint} size={24} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.menuGroupTitle}>{t('Your data')}</Text>
                {/* Analytics, history and records now live behind the Progress
                    tab. Keeping the three menu rows as well would give each of
                    them two entry points with different presentations — a pushed
                    card from here, an inline panel from the tab bar. */}
                <MenuOption
                  icon={<TrendingUp color={colors.textMuted} size={20}/>}
                  label={t('Progress')}
                  value={t('Stats, history, records')}
                  onPress={needsAccount(() => { onClose(); onOpenProgress(); })}
                  locked={!isLoggedIn}
                />
                <MenuOption
                  icon={<Scale color={colors.textMuted} size={20}/>}
                  label={t('Body weight')}
                  onPress={needsAccount(() => { onClose(); onOpenWeight(); })}
                  locked={!isLoggedIn}
                />

                <Text style={styles.menuGroupTitle}>{t('Settings')}</Text>
                <MenuOption
                  icon={<Bell color={colors.textMuted} size={20}/>}
                  label={t('Rest timer alerts')}
                  value={restAlerts ? t('On') : t('Off')}
                  onPress={onToggleRestAlerts}
                />
                {/* Automatic follows the training goal. Anyone who disagrees
                    with that — and most serious lifters will — sets their own. */}
                <MenuOption
                  icon={<Timer color={colors.textMuted} size={20}/>}
                  label={t('Rest length')}
                  value={t(labelForRestChoice(restSeconds))}
                  onPress={onCycleRestLength}
                />
                <MenuOption
                  icon={<Flame color={colors.textMuted} size={20}/>}
                  label={t('Streak reminder')}
                  value={streakReminders ? '19:00' : t('Off')}
                  onPress={needsAccount(onToggleStreakReminders)}
                  locked={!isLoggedIn}
                />
                <MenuOption
                  icon={<Droplets color={colors.textMuted} size={20}/>}
                  label={t('Water reminders')}
                  value={waterReminders ? t('3 a day') : t('Off')}
                  onPress={needsAccount(onToggleWaterReminders)}
                  locked={!isLoggedIn}
                />
                {/* Display only. Everything is stored metric, so switching is
                     reversible and changes no recorded figure. */}
                <MenuOption
                  icon={<Ruler color={colors.textMuted} size={20}/>}
                  label={t('Units')}
                  value={units === 'imperial' ? t('Imperial (lb, ft)') : t('Metric (kg, cm)')}
                  onPress={() => setUnits(units === 'imperial' ? 'metric' : 'imperial')}
                />
                {/* Automatic follows the phone. The value names the language in
                    itself, so someone who switched by accident can read the way back. */}
                <MenuOption
                  icon={<Languages color={colors.textMuted} size={20}/>}
                  label={t('Language')}
                  value={preference === 'auto' ? `${t('Automatic')} (${LANGUAGE_NAMES[language]})` : LANGUAGE_NAMES[preference]}
                  onPress={() => setPreference(nextLanguage)}
                />
                {/* Apple asks for the policy to be reachable inside the app, not
                     only from the store listing. */}
                <MenuOption
                  icon={<Shield color={colors.textMuted} size={20}/>}
                  label={t('Privacy policy')}
                  onPress={() => {
                    if (!LINKS_CONFIGURED) {
                      return Alert.alert(t('Coming soon'), t('The privacy policy will be available here soon.'));
                    }
                    Linking.openURL(PRIVACY_URL);
                  }}
                />
                {/* Next to the policy that promises it: a copy of everything the
                    account holds, as JSON, through the share sheet. */}
                {isLoggedIn ? (
                  <MenuOption
                    icon={<Download color={colors.textMuted} size={20}/>}
                    label={t('Export my data')}
                    onPress={onExportData}
                  />
                ) : null}
                <MenuOption
                  icon={<HelpCircle color={colors.textMuted} size={20}/>}
                  label={t('How scoring works')}
                  onPress={() =>
                    Alert.alert(t('How scoring works'), t(SCORING_TEXT))
                  }
                />
              </ScrollView>
              <View style={styles.menuFooter}>
                {isLoggedIn ? (
                  <>
                    <TouchableOpacity activeOpacity={0.7} style={styles.logoutButton} onPress={onSignOut} accessibilityRole="button">
                      <LogOut color={colors.danger} size={20} /><Text style={styles.logoutText}>{t('Sign out')}</Text>
                    </TouchableOpacity>

                    {/* Quiet and last. It has to be findable — Play requires it
                        reachable from inside the app — without sitting next to
                        Sign Out looking like the same kind of button. */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.deleteAccountBtn}
                      onPress={onDeleteAccount}
                      accessibilityLabel={t('Delete my account')}
                    >
                      <Text style={styles.deleteAccountText}>{t('Delete my account')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity activeOpacity={0.7} style={styles.loginButtonWrapper} onPress={() => { onClose(); onSignIn(); }}>
                    <Text style={styles.loginButtonText}>{t('Log in or sign up')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </View>
        </Modal>
  );
}

function MenuOption({ icon, label, value, onPress, locked }) {
  return (
    <TouchableOpacity activeOpacity={0.7}
      style={[styles.menuOption, locked && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={locked ? 'Needs an account. Opens sign in.' : undefined}
    >
      <View style={styles.menuOptionLeft}>{icon}<Text style={styles.menuOptionText}>{label}</Text></View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {value ? <Text style={styles.menuOptionValue}>{value}</Text> : null}
        <ChevronRight color={colors.borderLight} size={18} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  menuOverlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row' },
  menuCloseArea: { flex: 1 },
  sideMenuContent: { width: width * 0.75, backgroundColor: colors.card, paddingHorizontal: 26 },
  sidebarProfileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingVertical: 10 },
  sidebarName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sidebarXpBarBg: { height: 4, backgroundColor: colors.surfaceHigh, borderRadius: 2, marginTop: 10, width: 100, overflow: 'hidden' },
  sidebarXpBarFill: { height: '100%', backgroundColor: colors.accent },
  sidebarXpText: { color: colors.textMuted, fontSize: 11, marginTop: 6, fontWeight: '600' },
  viewProfileSidebar: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  menuGroupTitle: { color: colors.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 16 },
  menuDivider: { height: 1, backgroundColor: colors.surfaceHigh, marginVertical: 20 },
  menuFooter: { marginTop: 'auto', paddingTop: 20 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '600', marginLeft: 16 },
  deleteAccountBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  deleteAccountText: { color: colors.textFaint, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  loginButtonWrapper: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 'auto' },
  loginButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  menuOptionLeft: { flexDirection: 'row', alignItems: 'center' },
  menuOptionText: { color: colors.text, fontSize: 15, marginLeft: 16 },
  menuOptionValue: { color: colors.textMuted, fontSize: 13, marginRight: 10 },
});
