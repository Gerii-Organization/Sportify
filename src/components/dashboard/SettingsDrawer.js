import { View, Text, Modal, ScrollView, TouchableOpacity, Dimensions, Alert, Linking, StyleSheet } from 'react-native';
import { Bell, Timer, Flame, Droplets, Ruler, Shield, HelpCircle, Scale, TrendingUp, LogIn, ChevronRight } from 'lucide-react-native';
import { colors } from '../../theme';
import { labelForRestChoice } from '../../lib/rest';
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
  onSignOut,
  onSignIn,
  onOpenProgress,
}) {
  return (
        <Modal visible={visible} transparent animationType="fade">
          <View style={styles.menuOverlaySide}>
            <TouchableOpacity activeOpacity={0.7} style={styles.menuCloseArea} onPress={onClose} />
            <View style={styles.sideMenuContent}>

              {/* The whole profile block is tappable, not just the avatar. */}
              <TouchableOpacity activeOpacity={0.7}
                style={styles.sidebarProfileSection}
                onPress={() => {
                  if (isLoggedIn) {
                    onClose();
                    onOpenProfile();
                  }
                }}
              >
                {renderAvatar(56, 30)}
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text style={styles.sidebarName}>{isLoggedIn ? (userProfile?.first_name || 'User') : 'Guest'}</Text>

                  {isLoggedIn && userProfile?.equipped_title && (
                     <Text style={{color: colors.accent, fontSize: 13, fontWeight: '600', marginBottom: 6}}>{userProfile.equipped_title}</Text>
                  )}

                  {isLoggedIn ? (
                    <View>
                      <View style={styles.sidebarXpBarBg}>
                        <View style={[styles.sidebarXpBarFill, { width: xpPercentage }]} />
                      </View>
                      <Text style={styles.sidebarXpText}>Lvl {level} • {levelXp}/100 XP</Text>
                    </View>
                  ) : (
                    <Text style={[styles.viewProfileSidebar, { color: colors.textSecondary }]}>Not logged in</Text>
                  )}
                </View>
                {isLoggedIn && <ChevronRight color={colors.textFaint} size={24} />}
              </TouchableOpacity>

              <View style={styles.menuDivider} />
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.menuGroupTitle}>Your data</Text>
                {/* Analytics, history and records now live behind the Progress
                    tab. Keeping the three menu rows as well would give each of
                    them two entry points with different presentations — a pushed
                    card from here, an inline panel from the tab bar. */}
                <MenuOption
                  icon={<TrendingUp color={colors.textMuted} size={20}/>}
                  label="Progress"
                  value="Stats, history, records"
                  onPress={() => { onClose(); onOpenProgress(); }}
                  disabled={!isLoggedIn}
                />
                <MenuOption
                  icon={<Scale color={colors.textMuted} size={20}/>}
                  label="Body weight"
                  onPress={() => { onClose(); onOpenWeight(); }}
                  disabled={!isLoggedIn}
                />

                <Text style={styles.menuGroupTitle}>Settings</Text>
                <MenuOption
                  icon={<Bell color={colors.textMuted} size={20}/>}
                  label="Rest timer alerts"
                  value={restAlerts ? 'On' : 'Off'}
                  onPress={onToggleRestAlerts}
                />
                {/* Automatic follows the training goal. Anyone who disagrees
                    with that — and most serious lifters will — sets their own. */}
                <MenuOption
                  icon={<Timer color={colors.textMuted} size={20}/>}
                  label="Rest length"
                  value={labelForRestChoice(restSeconds)}
                  onPress={onCycleRestLength}
                />
                <MenuOption
                  icon={<Flame color={colors.textMuted} size={20}/>}
                  label="Streak reminder"
                  value={streakReminders ? '19:00' : 'Off'}
                  onPress={onToggleStreakReminders}
                  disabled={!isLoggedIn}
                />
                <MenuOption
                  icon={<Droplets color={colors.textMuted} size={20}/>}
                  label="Water reminders"
                  value={waterReminders ? '3 a day' : 'Off'}
                  onPress={onToggleWaterReminders}
                  disabled={!isLoggedIn}
                />
                {/* Display only. Everything is stored metric, so switching is
                     reversible and changes no recorded figure. */}
                <MenuOption
                  icon={<Ruler color={colors.textMuted} size={20}/>}
                  label="Units"
                  value={units === 'imperial' ? 'Imperial (lb, ft)' : 'Metric (kg, cm)'}
                  onPress={() => setUnits(units === 'imperial' ? 'metric' : 'imperial')}
                />
                {/* Apple asks for the policy to be reachable inside the app, not
                     only from the store listing. */}
                <MenuOption
                  icon={<Shield color={colors.textMuted} size={20}/>}
                  label="Privacy policy"
                  onPress={() => {
                    if (!LINKS_CONFIGURED) {
                      return Alert.alert('Not published yet', 'The privacy policy URL has not been set in src/constants/links.js.');
                    }
                    Linking.openURL(PRIVACY_URL);
                  }}
                />
                <MenuOption
                  icon={<HelpCircle color={colors.textMuted} size={20}/>}
                  label="How scoring works"
                  onPress={() =>
                    Alert.alert(
                      'How scoring works',
                      'XP: 50 per workout, +20 when you lift over 1000 kg, 30 for hitting your water goal.\n\n' +
                      'Those thresholds are metric wherever you have the app set to pounds — they are counted on the stored figure.\n\n' +
                      'Energy: 5 per minute trained, up to 500 a session. Spend it in the Shop.\n\n' +
                      'Streak: one workout on consecutive calendar days. Miss a day and it resets, but the old streak can be bought back.'
                    )
                  }
                />
              </ScrollView>
              <View style={styles.menuFooter}>
                {isLoggedIn ? (
                  <>
                    <TouchableOpacity activeOpacity={0.7} style={styles.logoutButton} onPress={onSignOut}>
                      <LogIn color={colors.danger} size={20} /><Text style={styles.logoutText}>Sign Out</Text>
                    </TouchableOpacity>

                    {/* Quiet and last. It has to be findable — Play requires it
                        reachable from inside the app — without sitting next to
                        Sign Out looking like the same kind of button. */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.deleteAccountBtn}
                      onPress={onDeleteAccount}
                      accessibilityLabel="Delete my account"
                    >
                      <Text style={styles.deleteAccountText}>Delete my account</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity activeOpacity={0.7} style={styles.loginButtonWrapper} onPress={() => { onClose(); onSignIn(); }}>
                    <Text style={styles.loginButtonText}>Log In / Create Account</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
  );
}

function MenuOption({ icon, label, value, onPress, disabled }) {
  return (
    <TouchableOpacity activeOpacity={0.7}
      style={[styles.menuOption, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
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
  sideMenuContent: { width: width * 0.75, backgroundColor: colors.card, padding: 26, paddingTop: 60 },
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
