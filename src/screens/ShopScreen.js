import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { ShoppingBag, ChevronLeft, ChevronRight, Zap, Circle, User, Shield, Check, Flame, Crown, Swords, Ghost, Hexagon, Triangle, BatteryCharging, Trophy, Clock, Gift, Tag, Snowflake } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { RINGS, AVATARS, BADGES, TITLES, POWERUPS } from '../constants/cosmetics';
import { gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import AmbientGlow from '../components/AmbientGlow';
import { SkeletonShelf } from '../components/Skeleton';
import useRefresh from '../lib/useRefresh';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import { todayKey } from '../lib/date';

const { width } = Dimensions.get('window');

const PURCHASE_ERRORS = {
  insufficient_funds: "You do not have enough energy for this.",
  nothing_to_restore: "You have no lost streak to restore right now.",
  already_active: "Coin Boost is already waiting for your next workout.",
  no_profile: "Your profile could not be loaded. Try signing in again."
};

/**
 * Shelves in the order they matter: things that change how you play first,
 * things that change how you look after. Each carries a one-line note, because
 * a category name alone does not tell you why you would want anything on it.
 */
const SHELVES = [
  { key: 'powerup', type: 'powerup', title: 'Power-ups', note: 'Spent once, felt immediately', pick: (d) => d.powerups },
  { key: 'title',   type: 'title',   title: 'Titles',    note: 'Shown next to your name',     pick: (d) => d.titles },
  { key: 'ring',    type: 'ring',    title: 'Progress rings', note: 'The shape around your daily steps', pick: (d) => d.rings },
  { key: 'avatar',  type: 'avatar',  title: 'Avatar frames',  note: 'How friends see you in lists',      pick: (d) => d.avatars },
];

export default function ShopScreen({ navigation }) {
  const { refreshControl } = useRefresh(() => fetchShopData());
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [profileData, setProfileData] = useState(null);

  const [rings, setRings] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [badges, setBadges] = useState([]);
  const [titles, setTitles] = useState([]);
  const [powerups, setPowerups] = useState(POWERUPS);

  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [boostExpiresAt, setBoostExpiresAt] = useState(null);
  /** The spin resets at midnight; the card says so rather than failing on tap. */
  const spinUsed = profileData?.last_spin_date === todayKey();
  const [timeLeftStr, setTimeLeftStr] = useState(null);

  useEffect(() => {
    if (!boostExpiresAt) {
      setTimeLeftStr(null);
      return;
    }
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const exp = new Date(boostExpiresAt).getTime();
      const diff = exp - now;

      if (diff <= 0) {
        setTimeLeftStr(null);
        setBoostExpiresAt(null);
        clearInterval(interval);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeftStr(`${h}h ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [boostExpiresAt]);

  useFocusEffect(
    useCallback(() => {
    // user?.id is in the deps because useCallback pins the closure: without it
    // the memoised function keeps the `user` from first render (null, before the
    // session loads) and every later focus re-runs that stale copy — which is
    // why signing in left the screen empty until something forced a remount.
      fetchShopData();
    }, [user?.id])
  );

  const fetchShopData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBalance(0);
        setRings(RINGS.map(item => ({ ...item, owned: false, equipped: false })));
        setAvatars(AVATARS.map(item => ({ ...item, owned: false, equipped: false })));
        setBadges(BADGES.map(item => ({ ...item, owned: false, equipped: false })));
        setTitles(TITLES.map(item => ({ ...item, owned: false, equipped: false })));
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('xp, energy_points, streak_freezes, equipped_ring, equipped_avatar, equipped_badge, equipped_title, owned_titles, coin_boost_active, last_spin_date, xp_boost_expires_at, current_streak, previous_streak')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) return;

      setProfileData(profile);

      const { data: inventory, error: invError } = await supabase.from('user_inventory').select('item_id').eq('user_id', user.id);
      if (invError) throw invError;

      const ownedItemIds = new Set(inventory.map(item => item.item_id));
      const ownedTitleIds = new Set(profile.owned_titles || ['Novice']);

      setBalance(profile.energy_points || 0);

      if (profile.xp_boost_expires_at && new Date(profile.xp_boost_expires_at) > new Date()) {
        setBoostExpiresAt(profile.xp_boost_expires_at);
      } else {
        setBoostExpiresAt(null);
      }

      setRings(RINGS.map(item => ({
        ...item,
        owned: item.price === 0 || ownedItemIds.has(item.id),
        equipped: profile.equipped_ring === item.id
      })));

      setAvatars(AVATARS.map(item => ({
        ...item,
        owned: item.price === 0 || ownedItemIds.has(item.id),
        equipped: profile.equipped_avatar === item.id
      })));

      setBadges(BADGES.map(item => ({
        ...item,
        owned: item.price === 0 || ownedItemIds.has(item.id),
        equipped: profile.equipped_badge === item.id
      })));

      setTitles(TITLES.map(item => ({
        ...item,
        owned: ownedTitleIds.has(item.id),
        equipped: profile.equipped_title === item.id
      })));

    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * The reward roll and the once-a-day check both happen in the database now.
   * When they lived here, the roll could be re-rolled by restarting the app and
   * the date check could be bypassed by changing the device clock.
   *
   * This also fixes the bug that made every spin reset total XP: the old code
   * read the profile, added the prize in JavaScript and wrote the sum back, but
   * `xp` was missing from the SELECT, so the sum was always 0 + prize.
   */
  const handleDailySpin = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('daily_spin');
    setLoading(false);

    if (error) {
      Alert.alert('Spin failed', error.message);
      return;
    }
    if (!data?.ok) {
      if (data?.reason === 'already_spun') {
        Alert.alert('Come back tomorrow', 'You have already used your daily spin.');
      } else {
        Alert.alert('Spin unavailable', 'Please try again in a moment.');
      }
      return;
    }

    const prize = data.xp > 0 ? `JACKPOT! +${data.xp} XP 🔥` : `+${data.energy} Energy ⚡`;
    Alert.alert('🎰 Lucky Spin', `You won: ${prize}`);
    fetchShopData();
    refreshProfile();
  };

  const handleAction = async (item, categoryType) => {
    if (categoryType !== 'powerup' && item.equipped) return;

    if (categoryType === 'powerup' && item.id === 'p2') {
      if (!profileData || !profileData.previous_streak || profileData.previous_streak <= profileData.current_streak) {
        Alert.alert("Not Available", "You don't have any lost streak to restore right now.");
        return;
      }
    }

    if (categoryType === 'powerup' && item.id === 'p3') {
      if (profileData?.coin_boost_active) {
        Alert.alert('Active', 'Coin Boost is already active for your next workout!');
        return;
      }
    }

    if (item.owned && categoryType !== 'powerup') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let updateField = '';
      if (categoryType === 'ring') updateField = 'equipped_ring';
      if (categoryType === 'avatar') updateField = 'equipped_avatar';
      if (categoryType === 'badge') updateField = 'equipped_badge';
      if (categoryType === 'title') updateField = 'equipped_title';

      const { error } = await supabase.from('profiles').update({ [updateField]: item.id }).eq('id', user.id);
      if (!error) fetchShopData();
    } else {
      if (balance >= item.price) {
        setSelectedItem({ item, categoryType });
        setPurchaseModalVisible(true);
      } else {
        const short = item.price - balance;
        Alert.alert(
          'Not enough energy',
          `You need ${short} more ⚡ for ${item.name || item.id}. Finish a workout to earn more — you get 5 ⚡ per minute trained.`
        );
      }
    }
  };

  /**
   * One call, one transaction. The server checks the balance, deducts it,
   * records the item and applies the effect — all while holding a lock on the
   * profile row, so double-tapping cannot spend the same energy twice.
   */
  const confirmPurchase = async () => {
    if (!selectedItem) return;
    const { item, categoryType } = selectedItem;
    setPurchaseModalVisible(false);

    const { data, error } = await supabase.rpc('purchase_item', {
      p_item_id: item.id,
      p_item_type: categoryType,
      p_price: item.price,
    });

    if (error) {
      Alert.alert('Purchase failed', error.message);
      return;
    }

    if (!data?.ok) {
      Alert.alert('Could not buy this', PURCHASE_ERRORS[data?.reason] || 'Please try again.');
      fetchShopData();
      return;
    }

    if (item.id === 'p2') Alert.alert('Streak restored', 'Your previous streak is back.');
    if (item.id === 'p3') Alert.alert('Coin Boost ready', 'Active for your next workout.');
    if (item.id === 'p4') Alert.alert('Streak Freeze added', 'The next day you miss will not break your streak.');

    fetchShopData();
    refreshProfile();
  };

  const renderVisualPreview = (item, categoryType) => {
    if (categoryType === 'ring') {
      if (item.type === 'inferno') {
        return (
          <View style={styles.previewContainer}>
            <Circle color={item.color} size={40} strokeWidth={3} />
            <Flame color={colors.streak} size={20} style={styles.absoluteTop} />
            <Flame color={colors.streak} size={20} style={styles.absoluteBottom} />
          </View>
        );
      }
      if (item.type === 'cyber') {
        return (
          <View style={styles.previewContainer}>
            <Hexagon color={item.color} size={44} strokeWidth={2} />
            <Hexagon color="#FF00FF" size={34} strokeWidth={1} style={styles.absoluteCenter} />
          </View>
        );
      }
      if (item.type === 'toxic') {
        return (
          <View style={styles.previewContainer}>
            <Triangle color={item.color} size={46} strokeWidth={3} />
            <Circle color={colors.onAccent} size={10} style={styles.absoluteCenter} fill={item.color} />
          </View>
        );
      }
      if (item.type === 'pulse') {
        return (
          <View style={styles.previewContainer}>
            <Circle color={item.color} size={40} strokeWidth={2} />
            <Circle color={item.color} size={28} strokeWidth={2} opacity={0.5} style={styles.absoluteCenter} />
          </View>
        );
      }
      if (item.type === 'diamond') {
        return (
          <View style={[styles.previewContainer, { transform: [{rotate: '45deg'}] }]}>
            <View style={{ width: 32, height: 32, borderWidth: 3, borderColor: item.color }} />
          </View>
        );
      }
      if (item.type === 'quantum') {
        return (
          <View style={styles.previewContainer}>
            <Hexagon color={item.color} size={46} strokeWidth={2} style={{ transform: [{rotate: '30deg'}] }} />
            <Hexagon color={item.color} size={46} strokeWidth={2} style={{ position: 'absolute', transform: [{rotate: '60deg'}] }} />
          </View>
        );
      }
      return <Circle color={item.color} size={36} strokeWidth={4} />;
    }

    if (categoryType === 'avatar') {
      if (item.type === 'royal') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 3 }]}>
            <User color={colors.text} size={24} />
            <Crown color={item.color} size={22} style={styles.absoluteTopOffset} fill="rgba(255, 215, 0, 0.3)" />
          </View>
        );
      }
      if (item.type === 'demon' || item.type === 'inferno_avatar') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 2, borderStyle: item.type === 'demon' ? 'dashed' : 'solid', shadowColor: item.color, shadowOpacity: 0.8, shadowRadius: 8 }]}>
            <User color={colors.text} size={24} />
            <Flame color={item.color} size={30} style={styles.absoluteBackground} />
          </View>
        );
      }
      if (item.type === 'glitch') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 2, borderRadius: 12 }]}>
            <User color="#00EAFF" size={26} style={{ marginLeft: -2 }} />
            <User color="#FF00FF" size={26} style={styles.absoluteCenterOffset} />
          </View>
        );
      }
      if (item.type === 'holo') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 2, shadowColor: item.color, shadowOpacity: 1, shadowRadius: 15 }]}>
            <User color={item.color} size={24} />
          </View>
        );
      }
      if (item.type === 'void') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 4, shadowColor: '#fff', shadowOpacity: 0.2, shadowRadius: 5 }]}>
            <User color={colors.textDisabled} size={24} />
          </View>
        );
      }
      return (
        <View style={[styles.avatarFrame, { borderColor: '#444' }]}>
          <User color={colors.text} size={24} />
        </View>
      );
    }

    if (categoryType === 'badge') {
      let IconObj = Shield;
      if (item.icon === 'Swords') IconObj = Swords;
      if (item.icon === 'Ghost') IconObj = Ghost;
      if (item.icon === 'Crown') IconObj = Crown;

      return (
        <View style={[styles.previewContainer, { backgroundColor: `${item.color}22`, borderRadius: 28 }]}>
          <IconObj color={item.color} size={32} />
        </View>
      );
    }

    if (categoryType === 'title') {
      return (
        <View style={[styles.previewContainer, { backgroundColor: `rgba(46, 211, 198, 0.1)`, borderRadius: 18 }]}>
          <Tag color={colors.accent} size={32} />
        </View>
      );
    }

    if (categoryType === 'powerup') {
      let IconObj = BatteryCharging;
      if (item.icon === 'Zap') IconObj = Zap;
      if (item.icon === 'Trophy') IconObj = Trophy;
      if (item.icon === 'Flame') IconObj = Flame;
      if (item.icon === 'Snowflake') IconObj = Snowflake;

      return (
        <View style={[styles.previewContainer, { backgroundColor: `${item.color}15`, borderRadius: 18, padding: 10 }]}>
          <IconObj color={item.color} size={38} />
        </View>
      );
    }
  };

  const renderItemCard = (item, categoryType) => {
    const isPowerup = categoryType === 'powerup';
    const isLocked = !isPowerup && !item.owned;
    const isEquipped = !isPowerup && item.equipped;

    // XP boost still running, or a coin boost waiting for the next workout.
    const isBoostActive = (item.id === 'p1' && timeLeftStr) || (item.id === 'p3' && profileData?.coin_boost_active);

    return (
      <Press
        key={item.id}
        scale={0.955}
        style={[
          styles.itemCard,
          isEquipped && styles.itemCardEquipped,
          isBoostActive && { borderColor: colors.energy, backgroundColor: 'rgba(255, 215, 0, 0.05)' }
        ]}
        onPress={() => {
          if (isBoostActive) return;
          handleAction(item, categoryType);
        }}
        disabled={isBoostActive}
      >
        <View style={styles.itemPreviewBox}>
          {renderVisualPreview(item, categoryType)}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name || item.id}</Text>
          {item.desc && <Text style={styles.itemDesc}>{item.desc}</Text>}

          {isEquipped ? (
            <View style={styles.statusBadge}>
              <Check color={colors.accent} size={14} />
              <Text style={styles.statusTextEquipped}>Equipped</Text>
            </View>
          ) : isBoostActive ? (
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
              <Clock color={colors.energy} size={14} />
              <Text style={[styles.statusTextEquipped, { color: colors.energy }]}>{item.id === 'p3' ? 'Ready for Workout' : timeLeftStr}</Text>
            </View>
          ) : isLocked || isPowerup ? (
            <View style={styles.priceContainer}>
              <Zap color={colors.energy} size={14} />
              <Text style={styles.priceText}>{item.price}</Text>
            </View>
          ) : (
            <View style={styles.statusBadgeOwned}>
              <Text style={styles.statusTextOwned}>Equip</Text>
            </View>
          )}
        </View>
      </Press>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="ember" height={300} intensity={0.42} />
          <View style={styles.loadingContainer}>
            <SkeletonShelf count={3} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            activeOpacity={0.7}
          >
            <ChevronLeft color={colors.text} size={26} />
          </TouchableOpacity>
        </View>

        <ScreenHeader
          title="Shop"
          subtitle="Spend what you have earned"
          right={
            <BlurView intensity={30} tint="dark" style={styles.balanceContainer}>
              <Zap color={colors.energy} size={20} fill={colors.energy} />
              <Text style={styles.balanceText}>{balance}</Text>
            </BlurView>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}>

          {/* The spin is free and expires daily, so it leads — and it is the one
              card allowed a photographic gradient. Everything below it costs
              energy and shares one restrained treatment, so the eye is not
              asked to weigh four equally loud shelves. */}
          <Press scale={0.98} onPress={handleDailySpin} style={styles.spinCard} accessibilityLabel="Daily lucky spin">
            <LinearGradient
              colors={spinUsed ? [colors.surfaceHigh, colors.surface] : ['#FF9A3C', '#E0490A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.spinInner}
            >
              <View style={styles.spinGlyph}>
                <Gift color={spinUsed ? colors.textMuted : colors.text} size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.spinTitle, spinUsed && { color: colors.textSecondary }]}>
                  {spinUsed ? 'Spun for today' : 'Daily spin'}
                </Text>
                <Text style={[styles.spinSub, spinUsed && { color: colors.textMuted }]}>
                  {spinUsed ? 'Comes back tomorrow' : 'Free — energy or a burst of XP'}
                </Text>
              </View>
              {!spinUsed && <ChevronRight color={colors.text} size={22} />}
            </LinearGradient>
          </Press>

          {SHELVES.map((shelf, shelfIndex) => {
            const items = shelf.pick({ powerups, titles, rings, avatars });
            if (!items?.length) return null;

            return (
              <FadeIn key={shelf.key} index={shelfIndex} style={styles.shelfBlock}>
                <View style={styles.shelfHead}>
                  <Text style={styles.shelfTitle}>{shelf.title}</Text>
                  <Text style={styles.shelfNote}>{shelf.note}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shelfRow}
                >
                  {items.map((item) => renderItemCard(item, shelf.type))}
                </ScrollView>
              </FadeIn>
            );
          })}

        </ScrollView>

        <Modal transparent visible={purchaseModalVisible} animationType="fade">
        <View style={styles.modalOverlayFull}>
          <View style={styles.modalContent}>
            <ShoppingBag size={48} color={colors.accent} style={{ marginBottom: 20 }} />
            <Text style={styles.modalTitle}>Confirm Purchase</Text>
            <Text style={styles.modalText}>
              Do you want to buy {selectedItem?.item.name || selectedItem?.item.id} for <Text style={{color: colors.energy, fontWeight: '600'}}>{selectedItem?.item.price} ⚡</Text>?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={0.7} style={styles.modalCancelBtn} onPress={() => setPurchaseModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={styles.modalBuyBtn} onPress={confirmPurchase}>
                <Text style={styles.modalBuyText}>Buy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 40 },
  logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: colors.accent, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 10 },
  screenTitle: { color: colors.textMuted, marginTop: 16, fontSize: 15, marginLeft: 20 },
  navRow: { paddingHorizontal: 16, paddingTop: 10, marginBottom: -14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  balanceContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)' },
  balanceText: { color: colors.energy, fontSize: 17, fontWeight: '700', marginLeft: 10 },
  scrollContent: { paddingBottom: 120 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 20, marginTop: 20, marginBottom: 16 },
  horizontalScroll: { paddingHorizontal: 16, paddingRight: 26 },

  spinCard: { marginHorizontal: 20, marginBottom: 30, borderRadius: 26, overflow: 'hidden' },
  spinInner: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  spinGlyph: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  shelfBlock: { marginBottom: 30 },
  shelfHead: { paddingHorizontal: 20, marginBottom: 14 },
  shelfTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  shelfNote: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  shelfRow: { paddingHorizontal: 20, gap: 12 },
  spinTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  spinSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 3 },

  itemCard: { backgroundColor: colors.card, width: 140, borderRadius: 26, padding: 16, alignItems: 'center' },
  itemCardEquipped: { borderColor: colors.accent + 'AA', backgroundColor: 'rgba(46, 211, 198, 0.05)', shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  itemPreviewBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  previewContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  absoluteTop: { position: 'absolute', top: -10 },
  absoluteBottom: { position: 'absolute', bottom: -10, transform: [{ rotate: '180deg' }] },
  absoluteCenter: { position: 'absolute' },
  avatarFrame: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 2 },
  absoluteTopOffset: { position: 'absolute', top: -18 },
  absoluteBackground: { position: 'absolute', opacity: 0.4, zIndex: -1 },
  absoluteCenterOffset: { position: 'absolute', opacity: 0.7, marginLeft: 2 },
  itemInfo: { alignItems: 'center', width: '100%' },
  itemName: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  itemDesc: { color: colors.textSecondary, fontSize: 11, marginBottom: 10, textAlign: 'center' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  priceText: { color: colors.energy, fontWeight: '600', marginLeft: 6, fontSize: 13 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(46, 211, 198, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusTextEquipped: { color: colors.accent, fontWeight: '600', fontSize: 13, marginLeft: 6 },
  statusBadgeOwned: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusTextOwned: { color: colors.text, fontWeight: '600', fontSize: 13 },
  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.card, borderRadius: 32, padding: 26, width: '85%', alignItems: 'center' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 10 },
  modalText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 26 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalCancelBtn: { flex: 1, padding: 16, backgroundColor: colors.surface, borderRadius: 18, marginRight: 10, alignItems: 'center' },
  modalCancelText: { color: colors.text, fontWeight: '600' },
  modalBuyBtn: { flex: 1, padding: 16, backgroundColor: colors.accent, borderRadius: 18, marginLeft: 10, alignItems: 'center' }
});