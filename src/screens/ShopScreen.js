import { useState, useCallback, useEffect, useRef } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Zap, Check, Clock, Lock } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { RINGS, AVATARS, BADGES, TITLES, POWERUPS } from '../constants/cosmetics';
import { gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import FreeCard from '../components/FreeCard';
import EnergyBurst from '../components/EnergyBurst';
import BuySheet from '../components/BuySheet';
import ItemPreview from '../components/ItemPreview';
import AmbientGlow from '../components/AmbientGlow';
import { SkeletonShelf } from '../components/Skeleton';
import useRefresh from '../lib/useRefresh';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import { todayKey } from '../lib/date';

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
  { key: 'badge',   type: 'badge',   title: 'Badges',    note: 'Sits beside your name',        pick: (d) => d.badges },
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
  const [purchasing, setPurchasing] = useState(false);

  const [boostExpiresAt, setBoostExpiresAt] = useState(null);
  /** Resets at midnight; the card says so rather than failing on tap. */
  const rewardClaimedToday = profileData?.last_reward_date === todayKey();
  const [claiming, setClaiming] = useState(false);
  /** Where the claimed energy flies from and to, measured on layout. */
  const [burst, setBurst] = useState(null);
  const freeCardRef = useRef(null);
  const balanceRef = useRef(null);
  const shake = useSharedValue(0);
  const [burstRunning, setBurstRunning] = useState(false);
  /** Today's rotation. Empty until 20260913_daily_shop.sql is applied, in
   *  which case the section is just the free slot. */
  const [dailyDeals, setDailyDeals] = useState([]);
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
        .select('xp, energy_points, streak_freezes, equipped_ring, equipped_avatar, equipped_badge, equipped_title, owned_titles, coin_boost_active, last_reward_date, reward_day, xp_boost_expires_at, current_streak, previous_streak')
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

      // Missing until the migration runs. A shop that fails to open because a
      // rotation could not be fetched is worse than one without a rotation.
      const { data: deals } = await supabase.rpc('get_daily_shop');
      setDailyDeals(deals || []);

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
  /**
   * Claims today's rung of the ladder.
   *
   * The server decides which day you are on and what it pays, so a modified
   * client cannot claim day 7 on a Monday. It also refuses a second claim on
   * the same date, which is what makes the date check meaningful.
   */
  /**
   * Where the energy flies from and to.
   *
   * Measured rather than guessed: both ends move with the header's safe area
   * and with how many shelves are above the free slot, and a hardcoded
   * coordinate would be right on exactly one device.
   */
  const measureFreeCard = () => {
    freeCardRef.current?.measureInWindow?.((x, y, width, height) => {
      setBurst((prev) => ({ ...prev, from: { x: x + width / 2, y: y + height / 2 } }));
    });
  };

  const measureBalance = () => {
    balanceRef.current?.measureInWindow?.((x, y, width, height) => {
      setBurst((prev) => ({ ...prev, to: { x: x + width / 2, y: y + height / 2 } }));
    });
  };

  /** A short, sharp wobble. Anything longer reads as an error state. */
  const shakeBalance = () => {
    shake.value = withSequence(
      withTiming(-1, { duration: 55, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 70 }),
      withTiming(-0.6, { duration: 60 }),
      withTiming(0, { duration: 70 })
    );
  };

  const balanceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value * 5 },
      { rotate: `${shake.value * 3}deg` },
      { scale: 1 + Math.abs(shake.value) * 0.08 },
    ],
  }));

  const handleClaimReward = async () => {
    if (claiming || rewardClaimedToday) return;
    setClaiming(true);

    const { data, error } = await supabase.rpc('claim_daily_reward');
    setClaiming(false);

    if (error) return Alert.alert('Could not claim', error.message);

    if (!data?.ok) {
      if (data?.reason === 'already_claimed') {
        Alert.alert('Come back tomorrow', 'Today\u2019s reward is already yours.');
      } else {
        Alert.alert('Reward unavailable', 'Please try again in a moment.');
      }
      return;
    }

    // No alert. An alert to say a reward arrived is a dialog that stands
    // between you and the thing you just earned; the energy flying into the
    // balance says it, and the balance changing proves it.
    measureFreeCard();
    measureBalance();
    setBurstRunning(true);

    // Refreshed now rather than on arrival: the number should already be
    // correct behind the bolts, so the shake lands on the new figure.
    fetchShopData();
    refreshProfile();
  };

  /** Header for a shelf. The note says why you would want anything on it. */
  const SectionHead = ({ title, note }) => (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );

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
      // Both cases go to the same place. The sheet shows what you would be left
      // with when you can afford it, and how far off you are when you cannot —
      // which used to be an Alert, i.e. discoverable only by trying to buy.
      setSelectedItem({ item, categoryType });
      setPurchaseModalVisible(true);
    }
  };

  /**
   * One call, one transaction. The server checks the balance, deducts it,
   * records the item and applies the effect — all while holding a lock on the
   * profile row, so double-tapping cannot spend the same energy twice.
   */
  const confirmPurchase = async () => {
    if (!selectedItem || purchasing) return;
    const { item, categoryType } = selectedItem;
    setPurchasing(true);

    const { data, error } = await supabase.rpc('purchase_item', {
      p_item_id: item.id,
      p_item_type: categoryType,
      p_price: item.price,
    });

    setPurchasing(false);
    setPurchaseModalVisible(false);

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

  /**
   * One of today's discounted items.
   *
   * The old price is struck through beside the new one rather than replaced by
   * it: one number says what it costs, two say what you save, and the second is
   * the reason the section exists.
   */
  const renderDealCard = (deal) => {
    const catalogue = [...powerups, ...titles, ...rings, ...avatars, ...badges];
    const item = catalogue.find((x) => x.id === deal.id);
    if (!item) return null;

    const short = balance < deal.final_price;

    return (
      <Press
        key={`deal-${deal.id}`}
        scale={0.955}
        style={[styles.itemCard, styles.dealCard, short && styles.itemCardShort]}
        onPress={() => handleAction({ ...item, price: deal.final_price, owned: deal.owned }, deal.type)}
        accessibilityLabel={`${deal.name}, ${deal.discount} percent off, ${deal.final_price} energy`}
      >
        <View style={styles.dealFlag}>
          <Text style={styles.dealFlagText}>-{deal.discount}%</Text>
        </View>

        <View style={[styles.itemPreviewBox, short && styles.itemPreviewShort]}>
          <ItemPreview item={item} type={deal.type} />
        </View>

        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, short && styles.itemNameShort]}>{deal.name}</Text>

          {deal.owned ? (
            <View style={styles.statusBadgeOwned}>
              <Text style={styles.statusTextOwned}>Owned</Text>
            </View>
          ) : (
            <View style={styles.dealPrices}>
              <Text style={styles.dealWas}>{Number(deal.price).toLocaleString()}</Text>
              <View style={short ? styles.priceShort : styles.priceContainer}>
                {short
                  ? <Lock color={colors.textFaint} size={12} />
                  : <Zap color={colors.energy} size={14} />}
                <Text style={short ? styles.priceShortText : styles.priceText}>
                  {Number(deal.final_price).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Press>
    );
  };

  const renderItemCard = (item, categoryType) => {
    const isPowerup = categoryType === 'powerup';
    const isLocked = !isPowerup && !item.owned;
    const isEquipped = !isPowerup && item.equipped;

    // XP boost still running, or a coin boost waiting for the next workout.
    const isBoostActive = (item.id === 'p1' && timeLeftStr) || (item.id === 'p3' && profileData?.coin_boost_active);

    // Anything that would cost energy you do not have. Drawn as a state on the
    // card — a shelf where everything looks equally available is a shelf you
    // have to tap your way through to find out what you can afford.
    const forSale = isPowerup || isLocked;
    const short = forSale && !isBoostActive && balance < item.price;

    return (
      <Press
        key={item.id}
        scale={0.955}
        style={[
          styles.itemCard,
          short && styles.itemCardShort,
          isEquipped && styles.itemCardEquipped,
          isBoostActive && { borderColor: colors.energy, backgroundColor: 'rgba(255, 215, 0, 0.05)' }
        ]}
        onPress={() => {
          if (isBoostActive) return;
          handleAction(item, categoryType);
        }}
        disabled={isBoostActive}
      >
        <View style={[styles.itemPreviewBox, short && styles.itemPreviewShort]}>
          <ItemPreview item={item} type={categoryType} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, short && styles.itemNameShort]}>{item.name || item.id}</Text>
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
          ) : short ? (
            <View style={styles.priceShort}>
              <Lock color={colors.textFaint} size={12} />
              <Text style={styles.priceShortText}>{(item.price - balance).toLocaleString()} more</Text>
            </View>
          ) : forSale ? (
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
        {/* Shop is reachable both as a tab and, historically, as a pushed
            card. `canGoBack` is what tells the two apart — a back arrow on a
            root tab points at nothing. */}
        {navigation.canGoBack() && (
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
        )}

        <ScreenHeader
          title="Shop"
          subtitle="Spend what you have earned"
          right={
            <Animated.View
              ref={balanceRef}
              collapsable={false}
              onLayout={measureBalance}
              style={balanceStyle}
            >
              <BlurView intensity={30} tint="dark" style={styles.balanceContainer}>
                <Zap color={colors.energy} size={20} fill={colors.energy} />
                <Text style={styles.balanceText}>{balance.toLocaleString()}</Text>
              </BlurView>
            </Animated.View>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}>

          {/* Every shelf at once, in order, with the free slot at the top.
              The filter chips are gone: a shop you have to choose a department
              in before seeing anything is a catalogue, and the point of opening
              it is to see what there is. */}
          <FadeIn>
            <SectionHead title="Daily shop" note="Resets every day" />
            <View style={styles.grid}>
              <View
                ref={freeCardRef}
                collapsable={false}
                style={styles.freeSlot}
                onLayout={() => measureFreeCard()}
              >
                <FreeCard
                  day={profileData?.reward_day || 0}
                  claimedToday={rewardClaimedToday}
                  claiming={claiming}
                  onClaim={handleClaimReward}
                />
              </View>

              {dailyDeals.map((deal) => renderDealCard(deal))}
            </View>
          </FadeIn>

          {SHELVES.map((shelf, index) => {
            const items = shelf.pick({ powerups, titles, rings, avatars, badges }) || [];
            if (items.length === 0) return null;

            return (
              <FadeIn key={shelf.key} index={Math.min(index + 1, 6)}>
                <SectionHead title={shelf.title} note={shelf.note} />
                <View style={styles.grid}>
                  {items.map((item) => renderItemCard(item, shelf.type))}
                </View>
              </FadeIn>
            );
          })}

        </ScrollView>

        {/* Above everything, touches passed through. Mounted only while it
            runs, so nine animated views do not sit over the shop at rest. */}
        {burstRunning && (
          <EnergyBurst
            from={burst?.from}
            to={burst?.to}
            onArrive={shakeBalance}
            onDone={() => setBurstRunning(false)}
          />
        )}

        <BuySheet
          visible={purchaseModalVisible}
          onClose={() => setPurchaseModalVisible(false)}
          item={selectedItem?.item}
          type={selectedItem?.categoryType}
          balance={balance}
          busy={purchasing}
          onConfirm={confirmPurchase}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navRow: { paddingHorizontal: 16, paddingTop: 10, marginBottom: -14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  balanceContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)' },
  balanceText: { color: colors.energy, fontSize: 17, fontWeight: '700', marginLeft: 10 },
  scrollContent: { paddingBottom: 120 },

  sectionHead: { paddingHorizontal: 20, marginTop: 22, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sectionNote: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  // The free slot is one tile wide, like everything it sits beside.
  freeSlot: { width: '48%', flexGrow: 1 },
  dealCard: { borderWidth: 1, borderColor: 'rgba(255, 216, 74, 0.30)', overflow: 'hidden' },
  dealFlag: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.energy,
    paddingHorizontal: 9, paddingVertical: 3,
    borderBottomLeftRadius: 12,
  },
  dealFlagText: { color: '#2A1F00', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  dealPrices: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Struck through and muted: there to be compared against, not read.
  dealWas: {
    color: colors.textFaint, fontSize: 12, fontWeight: '600',
    textDecorationLine: 'line-through',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 },

  itemCard: { backgroundColor: colors.card, width: '48%', flexGrow: 1, borderRadius: 26, padding: 16, alignItems: 'center' },
  itemCardEquipped: { borderColor: colors.accent + 'AA', backgroundColor: 'rgba(46, 211, 198, 0.05)', shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  itemPreviewBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  itemInfo: { alignItems: 'center', width: '100%' },
  itemName: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  itemDesc: { color: colors.textSecondary, fontSize: 11, marginBottom: 10, textAlign: 'center' },
  // Out of reach: the card recedes rather than shouting. Still tappable — the
  // sheet is where the shortfall gets spelled out.
  itemCardShort: { backgroundColor: '#191C22' },
  itemPreviewShort: { opacity: 0.55 },
  itemNameShort: { color: colors.textSecondary },
  priceShort: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  priceShortText: { color: colors.textFaint, fontWeight: '600', fontSize: 13 },

  priceContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  priceText: { color: colors.energy, fontWeight: '600', marginLeft: 6, fontSize: 13 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(46, 211, 198, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusTextEquipped: { color: colors.accent, fontWeight: '600', fontSize: 13, marginLeft: 6 },
  statusBadgeOwned: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusTextOwned: { color: colors.text, fontWeight: '600', fontSize: 13 },
});