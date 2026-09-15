import { useState, useCallback, useEffect, useRef } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { StyleSheet, Text, View, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft, Zap, Star, Plus, Sparkles, BatteryCharging, Gem, Clock, Gift, Lock,
  CircleCheck, Snowflake, Trophy, Flame,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, TAB_BAR_CLEARANCE } from '../theme';
import { RINGS, AVATARS, BADGES, TITLES, POWERUPS } from '../constants/cosmetics';
import { SEASON_PRIZES } from '../lib/seasons';
import { DAILY_REWARDS } from '../constants/content';
import { FEATURED_BUNDLE, ENERGY_PACKS, IAP_ENABLED } from '../constants/storeOffers';
import { useAuth } from '../context/AuthContext';
import EnergyBurst from '../components/EnergyBurst';
import BuySheet from '../components/BuySheet';
import ItemPreview from '../components/ItemPreview';
import GoldenApexFrame from '../components/shop/GoldenApexFrame';
import { SkeletonShop } from '../components/Skeleton';
import useRefresh from '../lib/useRefresh';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import { todayKey } from '../lib/date';
import { msUntilUtcMidnight, msUntilUtcMonday, formatClock, formatHoursMinutes, formatDaysHours } from '../lib/shopClock';
import { rarityFor } from '../lib/rarity';

const PURCHASE_ERRORS = {
  insufficient_funds: "You do not have enough energy for this.",
  nothing_to_restore: "You have no lost streak to restore right now.",
  already_active: "Coin Boost is already waiting for your next workout.",
  no_profile: "Your profile could not be loaded. Try signing in again.",
  price_changed: "The price just changed. Check the new price and try again.",
  unknown_item: "This item is no longer in the shop.",
};

/**
 * Jump points, not filters.
 *
 * The chips came back with the new layout, but a chip that hides the
 * other departments turns the shop back into a catalogue you have to pick a
 * page in. Every section stays on screen; a chip scrolls to its section and
 * lights up as you scroll past it.
 */
const CHIPS = [
  { key: 'featured', label: 'For you', icon: Sparkles },
  { key: 'boosters', label: 'Boosters', icon: Zap },
  { key: 'bundles', label: 'Energy', icon: BatteryCharging },
  { key: 'prestige', label: 'Cosmetics', icon: Gem },
];

/** Cosmetic departments, in the order the wardrobe lists them. */
const WARDROBE = [
  { key: 'avatar', title: 'Avatar frames', kind: 'Avatar frame', pick: (c) => c.avatars },
  { key: 'ring', title: 'Progress rings', kind: 'Progress ring', pick: (c) => c.rings },
  { key: 'badge', title: 'Badges', kind: 'Profile badge', pick: (c) => c.badges },
  { key: 'title', title: 'Titles', kind: 'Title', pick: (c) => c.titles },
];

/**
 * Boosters drawn as a glyph in the shop's own two tones. ItemPreview uses each
 * power-up's catalogue colour, which is the right thing on a profile and three
 * unrelated yellows on a gold screen.
 */
const BOOSTER_GLYPHS = { Zap, Trophy, Flame, Snowflake };

function BoosterGlyph({ item, size }) {
  const Glyph = BOOSTER_GLYPHS[item.icon] || Zap;
  return <Glyph color={item.icon === 'Snowflake' ? colors.accent : colors.gold} size={size} />;
}

/**
 * Ownership and equipped state laid over the static catalogue. A guest owns
 * nothing, not even the free defaults — there is no profile to equip them on.
 */
function buildCatalogue(profile, ownedIds = new Set()) {
  const owns = (item) => !!profile && (item.price === 0 || ownedIds.has(item.id));
  const titles = new Set(profile?.owned_titles || ['Novice']);

  return {
    rings: RINGS.map((i) => ({ ...i, owned: owns(i), equipped: profile?.equipped_ring === i.id })),
    avatars: AVATARS.map((i) => ({ ...i, owned: owns(i), equipped: profile?.equipped_avatar === i.id })),
    badges: BADGES.map((i) => ({ ...i, owned: owns(i), equipped: profile?.equipped_badge === i.id })),
    titles: [
      ...TITLES.map((i) => ({ ...i, owned: !!profile && titles.has(i.id), equipped: profile?.equipped_title === i.id })),
      // Season titles cannot be bought, so they only appear once won.
      ...SEASON_PRIZES.filter((p) => titles.has(p.title)).map((p) => ({
        id: p.title, price: 0, desc: 'Won in a monthly season', seasonal: true,
        owned: true, equipped: profile?.equipped_title === p.title,
      })),
    ],
  };
}

/** "+150 energy", "+40 XP", "+200 energy · +1 streak freeze". */
function describeReward(reward) {
  if (!reward) return 'Energy';
  const parts = [];
  if (reward.energy) parts.push(`+${reward.energy} energy`);
  if (reward.xp) parts.push(`+${reward.xp} XP`);
  if (reward.freezes) parts.push(`+${reward.freezes} streak freeze${reward.freezes === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/**
 * Nothing on this screen costs real money yet. Said plainly on tap, rather
 * than hiding the offers until there is a store behind them — the layout is
 * the point of having them here now.
 */
const comingSoon = () => Alert.alert('Coming soon', 'Purchases with real money are not available yet.');

/**
 * A countdown that re-renders itself and nothing else.
 *
 * The shop shows up to four timers. Ticking them from the screen would redraw
 * every card once a second to change a few digits.
 *
 * `ms` is read fresh each tick through a ref, so a caller can pass an inline
 * function without restarting the interval on every parent render.
 * `onElapsed` fires when the value jumps UP (a midnight rolled over) or first
 * reaches zero (a boost ran out) — the two moments the data behind it is stale.
 */
function Ticker({ ms, format, style, onElapsed }) {
  const read = useRef(ms);
  read.current = ms;
  const elapsed = useRef(onElapsed);
  elapsed.current = onElapsed;
  const [value, setValue] = useState(() => ms());

  useEffect(() => {
    let last = read.current();
    const id = setInterval(() => {
      const next = read.current();
      if (next > last || (next <= 0 && last > 0)) elapsed.current?.();
      last = next;
      setValue(next);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <Text style={style}>{format(value)}</Text>;
}

function SectionHead({ title, note, right, badge }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionCopy}>
        <View style={styles.inlineGap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {badge}
        </View>
        {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export default function ShopScreen({ navigation }) {
  const { refreshControl } = useRefresh(() => fetchShopData());
  const { user, refreshProfile } = useAuth();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [profileData, setProfileData] = useState(null);
  const [catalogue, setCatalogue] = useState(() => buildCatalogue(null));

  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  /** Resets at midnight; the card says so rather than failing on tap. */
  const rewardClaimedToday = profileData?.last_reward_date === todayKey();
  const [claiming, setClaiming] = useState(false);
  /** Where the claimed energy flies from and to, measured on layout. */
  const [burst, setBurst] = useState(null);
  const claimRef = useRef(null);
  const balanceRef = useRef(null);
  const shake = useSharedValue(0);
  const [burstRunning, setBurstRunning] = useState(false);
  /** Today's rotation. Empty until 20260913_daily_shop.sql is applied, in
   *  which case Flash Rotation is just the free tribute. */
  const [dailyDeals, setDailyDeals] = useState([]);

  const scrollRef = useRef(null);
  /** Each section's y inside the scroll content, recorded on layout. */
  const sectionY = useRef({});
  const activeChipRef = useRef('featured');
  const [activeChip, setActiveChip] = useState('featured');
  const [wardrobeOpen, setWardrobeOpen] = useState(false);

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
        setProfileData(null);
        setCatalogue(buildCatalogue(null));
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('xp, energy_points, streak_freezes, equipped_ring, equipped_avatar, equipped_badge, equipped_title, owned_titles, coin_boost_active, last_reward_date, reward_day, xp_boost_expires_at, current_streak, previous_streak')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) return;

      const { data: inventory, error: invError } = await supabase.from('user_inventory').select('item_id').eq('user_id', user.id);
      if (invError) throw invError;

      setProfileData(profile);
      setBalance(profile.energy_points || 0);
      setCatalogue(buildCatalogue(profile, new Set(inventory.map((row) => row.item_id))));

      // Missing until the migration runs. A shop that fails to open because a
      // rotation could not be fetched is worse than one without a rotation.
      const { data: deals } = await supabase.rpc('get_daily_shop');
      setDailyDeals(deals || []);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Where the energy flies from and to.
   *
   * Measured rather than guessed: both ends move with the header's safe area
   * and with the hero card's height, and a hardcoded coordinate would be right
   * on exactly one device.
   */
  const measureFreeCard = () => {
    claimRef.current?.measureInWindow?.((x, y, w, h) => {
      setBurst((prev) => ({ ...prev, from: { x: x + w / 2, y: y + h / 2 } }));
    });
  };

  const measureBalance = () => {
    balanceRef.current?.measureInWindow?.((x, y, w, h) => {
      setBurst((prev) => ({ ...prev, to: { x: x + w / 2, y: y + h / 2 } }));
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

  /** The rung the tribute pays next. The server decides; this only labels it. */
  const lastDay = profileData?.reward_day || 0;
  const nextDay = rewardClaimedToday ? lastDay : (lastDay >= 7 ? 1 : lastDay + 1);
  const nextReward = DAILY_REWARDS[Math.max(nextDay, 1) - 1];

  /**
   * Claims today's rung of the ladder.
   *
   * The server decides which day you are on and what it pays, so a modified
   * client cannot claim day 7 on a Monday. It also refuses a second claim on
   * the same date, which is what makes the date check meaningful.
   */
  const handleClaimReward = async () => {
    if (claiming || rewardClaimedToday) return;
    setClaiming(true);

    const { data, error } = await supabase.rpc('claim_daily_reward');
    setClaiming(false);

    if (error) return Alert.alert('Could not claim', error.message);

    if (!data?.ok) {
      if (data?.reason === 'already_claimed') {
        Alert.alert('Come back tomorrow', 'Today’s reward is already yours.');
      } else {
        Alert.alert('Reward unavailable', 'Please try again in a moment.');
      }
      return;
    }

    // No alert. The energy flying into the balance says it, and the balance
    // changing proves it. An XP-only day has no energy to throw, so it skips
    // the bolts rather than animating currency that never arrives.
    if (nextReward?.energy) {
      measureFreeCard();
      measureBalance();
      setBurstRunning(true);
    }

    // Refreshed now rather than on arrival: the number should already be
    // correct behind the bolts, so the shake lands on the new figure.
    fetchShopData();
    refreshProfile();
  };

  const handleAction = async (item, categoryType) => {
    if (categoryType !== 'powerup' && item.equipped) return;

    if (categoryType === 'powerup' && item.id === 'p2') {
      if (!profileData || !profileData.previous_streak || profileData.previous_streak <= profileData.current_streak) {
        Alert.alert('Nothing to restore', 'You do not have a lost streak to bring back.');
        return;
      }
    }

    if (categoryType === 'powerup' && item.id === 'p3') {
      if (profileData?.coin_boost_active) {
        Alert.alert('Already active', 'Coin Boost is already waiting for your next workout.');
        return;
      }
    }

    if (item.owned && categoryType !== 'powerup') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const field = { ring: 'equipped_ring', avatar: 'equipped_avatar', badge: 'equipped_badge', title: 'equipped_title' }[categoryType];
      const { error } = await supabase.from('profiles').update({ [field]: item.id }).eq('id', user.id);
      if (!error) fetchShopData();
    } else {
      // Both cases go to the same place. The sheet shows what you would be left
      // with when you can afford it, and how far off you are when you cannot.
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

  // --- Chips ↔ sections ---------------------------------------------------

  const trackSection = (key) => (event) => {
    sectionY.current[key] = event.nativeEvent.layout.y;
  };

  const lightChip = (key) => {
    if (activeChipRef.current === key) return;
    activeChipRef.current = key;
    setActiveChip(key);
  };

  const handleScroll = (event) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    // The last section is often too short to ever reach the top of the
    // viewport, so hitting the bottom counts as having arrived at it.
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      return lightChip(CHIPS[CHIPS.length - 1].key);
    }
    let current = CHIPS[0].key;
    for (const { key } of CHIPS) {
      if ((sectionY.current[key] ?? Infinity) <= contentOffset.y + 32) current = key;
    }
    lightChip(current);
  };

  const jumpTo = (key) => {
    lightChip(key);
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - 8), animated: true });
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Dashboard');
  };

  // --- Cards --------------------------------------------------------------

  const findItem = (id, type) => {
    if (type === 'powerup') {
      const item = POWERUPS.find((p) => p.id === id);
      return item ? { item, kind: 'Booster' } : null;
    }
    const shelf = WARDROBE.find((w) => w.key === type);
    const item = shelf?.pick(catalogue).find((x) => x.id === id);
    return item ? { item, kind: shelf.kind } : null;
  };

  /**
   * One of today's discounted items.
   *
   * The old price is struck through beside the new one rather than replaced by
   * it: one number says what it costs, two say what you save, and the second is
   * the reason the section exists.
   */
  const renderDealCard = (deal) => {
    const found = findItem(deal.id, deal.type);
    if (!found) return null;
    const { item, kind } = found;

    const price = Number(deal.price) || 0;
    const finalPrice = Number(deal.final_price) || 0;
    const short = !deal.owned && balance < finalPrice;
    const rarity = rarityFor(price);

    return (
      <Press
        key={`deal-${deal.id}`}
        scale={0.96}
        style={[styles.dealCard, short && styles.cardShort]}
        onPress={() => handleAction({ ...item, price: finalPrice, owned: deal.owned }, deal.type)}
        accessibilityLabel={`${deal.name}, ${deal.discount} percent off, ${finalPrice} energy`}
      >
        <View style={styles.dealTop}>
          <View style={styles.discount}>
            <Text style={styles.discountText}>-{deal.discount}%</Text>
          </View>
          {rarity ? (
            <Text
              style={[styles.rarity, { color: rarity.color }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {rarity.label}
            </Text>
          ) : null}
        </View>

        <View style={styles.dealIcon}>
          {deal.type === 'powerup'
            ? <BoosterGlyph item={item} size={22} />
            : <ItemPreview item={item} type={deal.type} scale={0.72} />}
        </View>

        <Text style={styles.dealName} numberOfLines={1}>{deal.name}</Text>
        <Text style={styles.dealNote} numberOfLines={1}>{item.desc || kind}</Text>

        <View style={styles.dealPrice}>
          {deal.owned ? (
            <Text style={styles.ownedText}>Owned</Text>
          ) : (
            <>
              <Text style={styles.dealWas}>{price.toLocaleString()}</Text>
              {short
                ? <Lock color={colors.textFaint} size={11} />
                : <Zap color={colors.gold} size={11} fill={colors.gold} />}
              <Text style={[styles.dealNow, short && styles.textShort]}>{finalPrice.toLocaleString()}</Text>
            </>
          )}
        </View>
      </Press>
    );
  };

  const renderBooster = (item) => {
    // A coin boost waits for the next workout; an XP boost runs on the clock.
    const coinReady = item.id === 'p3' && !!profileData?.coin_boost_active;
    const xpUntil = item.id === 'p1' ? Date.parse(profileData?.xp_boost_expires_at || '') : NaN;
    const xpRunning = xpUntil > Date.now();
    const active = coinReady || xpRunning;
    const count = item.id === 'p4' ? profileData?.streak_freezes || 0 : 0;
    const short = !active && balance < item.price;

    return (
      <Press
        key={item.id}
        scale={0.98}
        style={[styles.booster, active && styles.boosterActive]}
        onPress={() => handleAction(item, 'powerup')}
        disabled={active}
        accessibilityLabel={active ? `${item.name}, active` : `${item.name}, ${item.price} energy`}
      >
        <View style={styles.boosterIcon}>
          <BoosterGlyph item={item} size={20} />
          {count > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>x{count}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.boosterCopy}>
          <View style={styles.inlineGap}>
            <Text style={styles.boosterName}>{item.name}</Text>
            {active ? (
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>ACTIVE</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.boosterDesc} numberOfLines={2}>{item.desc}</Text>
        </View>

        {coinReady ? (
          <View style={styles.equipped}>
            <CircleCheck color={colors.gold} size={14} />
            <Text style={styles.equippedText}>Equipped</Text>
          </View>
        ) : xpRunning ? (
          <View style={styles.equipped}>
            <Clock color={colors.gold} size={13} />
            <Ticker ms={() => xpUntil - Date.now()} format={formatHoursMinutes} style={styles.equippedText} onElapsed={fetchShopData} />
          </View>
        ) : (
          <View style={[styles.pricePill, short && styles.pricePillShort]}>
            {short
              ? <Lock color={colors.textFaint} size={12} />
              : <Zap color={colors.gold} size={12} fill={colors.gold} />}
            <Text style={[styles.pricePillText, short && styles.textShort]}>{item.price.toLocaleString()}</Text>
          </View>
        )}
      </Press>
    );
  };

  const renderPrestigeCard = (item, type, kind, cardWidth) => {
    // What you have beats how rare it is: once it is yours, the tag says so.
    const status = item.equipped ? 'EQUIPPED' : item.owned ? 'OWNED' : null;
    const short = !item.owned && balance < item.price;
    const rarity = rarityFor(item.price);

    return (
      <Press
        key={`${type}-${item.id}`}
        scale={0.97}
        style={[styles.prestige, { width: cardWidth }, item.equipped && styles.prestigeEquipped]}
        onPress={() => handleAction(item, type)}
        accessibilityLabel={`${item.name || item.id}, ${kind}${rarity ? `, ${rarity.key}` : ''}${status ? `, ${status.toLowerCase()}` : `, ${item.price} energy`}`}
      >
        <View style={[styles.halo, rarity && { borderColor: `${rarity.color}99` }]}>
          <ItemPreview item={item} type={type} scale={0.9} />
          {status ? (
            <View style={styles.haloTag}>
              <Text style={styles.haloTagText}>{status}</Text>
            </View>
          ) : rarity ? (
            <View style={[styles.haloTag, styles.rarityTag, { borderColor: `${rarity.color}66` }]}>
              <Text style={[styles.haloTagText, { color: rarity.color }]}>{rarity.label}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.prestigeName} numberOfLines={1}>{item.name || item.id}</Text>
        <Text style={styles.prestigeKind}>{kind}</Text>

        {item.equipped ? (
          <View style={[styles.prestigeBtn, styles.prestigeBtnEquipped]}>
            <CircleCheck color={colors.gold} size={14} />
            <Text style={[styles.prestigeBtnText, { color: colors.gold }]}>Equipped</Text>
          </View>
        ) : item.owned ? (
          <View style={styles.prestigeBtn}>
            <Text style={styles.prestigeBtnText}>Equip</Text>
          </View>
        ) : (
          <View style={styles.prestigeBtn}>
            {short
              ? <Lock color={colors.textFaint} size={13} />
              : <Zap color={colors.gold} size={13} fill={colors.gold} />}
            <Text style={[styles.prestigeBtnText, short && styles.textShort]}>{item.price.toLocaleString()}</Text>
          </View>
        )}
      </Press>
    );
  };

  // --- Screen -------------------------------------------------------------

  if (loading && !profileData) {
    return (
      <SafeAreaView style={styles.container}>
        <SkeletonShop />
      </SafeAreaView>
    );
  }

  const cardWidth = (width - 40 - 12) / 2;
  // Priced cosmetics only, most expensive first: the carousel is the display
  // window, the wardrobe below it is the full rail.
  const prestige = WARDROBE
    .flatMap((w) => w.pick(catalogue).filter((i) => i.price > 0).map((item) => ({ item, type: w.key, kind: w.kind })))
    .sort((a, b) => b.item.price - a.item.price);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header and chips stay put; only the shelves scroll under them. */}
      <View style={styles.header}>
        <Press scale={0.9} style={styles.backBtn} onPress={goBack} accessibilityLabel="Go back">
          <ChevronLeft color={colors.textSecondary} size={22} />
        </Press>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Shop</Text>
          <View style={styles.inlineGap}>
            <View style={styles.liveDot} />
            <Text style={styles.restockLabel}>New deals in</Text>
            <Ticker ms={msUntilUtcMidnight} format={formatClock} style={styles.restockTime} onElapsed={fetchShopData} />
          </View>
        </View>

        {/* Wraps onto two lines on narrow phones rather than squeezing the title. */}
        <View style={styles.wallet}>
          <View style={styles.xpChip} accessibilityLabel={`${(profileData?.xp || 0).toLocaleString()} XP`}>
            <Star color={colors.accent} size={13} fill={colors.accent} />
            <Text style={styles.xpText}>{(profileData?.xp || 0).toLocaleString()}</Text>
          </View>

          <Animated.View
            ref={balanceRef}
            collapsable={false}
            onLayout={measureBalance}
            style={[styles.energyChip, balanceStyle]}
          >
            <Zap color={colors.gold} size={13} fill={colors.gold} />
            <Text style={styles.energyText}>{balance.toLocaleString()}</Text>
            <Press hitSlop={10} scale={0.85} style={styles.plus} onPress={() => jumpTo('bundles')} accessibilityLabel="Get more energy">
              <Plus color={colors.onGold} size={14} strokeWidth={3} />
            </Press>
          </Animated.View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
        contentContainerStyle={styles.chips}
      >
        {CHIPS.map(({ key, label, icon: Icon }) => {
          const on = activeChip === key;
          return (
            <Press
              key={key}
              scale={0.95}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => jumpTo(key)}
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
            >
              <Icon
                color={on ? colors.onGold : key === 'prestige' ? colors.accent : colors.gold}
                size={16}
              />
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
            </Press>
          );
        })}
      </ScrollView>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={refreshControl}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <View onLayout={trackSection('featured')}>
          <FadeIn>
            <LinearGradient colors={gradients.goldCard} style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroLabel}>
                  <Zap color={colors.gold} size={12} fill={colors.gold} />
                  <Text style={styles.heroLabelText}>{FEATURED_BUNDLE.label.toUpperCase()}</Text>
                </View>
                <View style={styles.timePill}>
                  <Clock color={colors.textSecondary} size={12} />
                  <Ticker ms={msUntilUtcMonday} format={(ms) => `${formatDaysHours(ms)} left`} style={styles.timePillText} />
                </View>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>{FEATURED_BUNDLE.name}</Text>
                  <View style={styles.heroPerks}>
                    <Zap color={colors.gold} size={13} fill={colors.gold} />
                    <Text style={styles.heroEnergy}>+{FEATURED_BUNDLE.energy.toLocaleString()} energy</Text>
                    <View style={styles.dot} />
                    <Text style={styles.heroFreeze}>{FEATURED_BUNDLE.freezes} streak freezes</Text>
                  </View>
                  <Text style={styles.heroPerk}>{FEATURED_BUNDLE.perk}</Text>
                </View>

                <View style={styles.heroArt}>
                  <GoldenApexFrame size={108} />
                  {IAP_ENABLED ? <Text style={styles.heroWas}>{FEATURED_BUNDLE.was}</Text> : null}
                  <Press
                    scale={0.94}
                    style={styles.heroPrice}
                    onPress={comingSoon}
                    accessibilityLabel={IAP_ENABLED ? `${FEATURED_BUNDLE.name}, ${FEATURED_BUNDLE.price}` : `${FEATURED_BUNDLE.name}, coming soon`}
                  >
                    <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroPriceFill}>
                      <Text style={styles.heroPriceText}>{IAP_ENABLED ? FEATURED_BUNDLE.price : 'Soon'}</Text>
                    </LinearGradient>
                  </Press>
                </View>
              </View>
            </LinearGradient>

            <SectionHead
              title="DAILY DEALS"
              right={
                <View style={styles.inlineGap}>
                  <Clock color={colors.gold} size={13} />
                  <Ticker ms={msUntilUtcMidnight} format={formatHoursMinutes} style={styles.goldTime} />
                </View>
              }
            />

            <View
              ref={claimRef}
              collapsable={false}
              onLayout={measureFreeCard}
              style={[styles.tribute, rewardClaimedToday && styles.tributeDone]}
            >
              <View style={[styles.tributeIcon, rewardClaimedToday && styles.tributeIconDone]}>
                <Gift color={rewardClaimedToday ? colors.textFaint : colors.gold} size={24} />
              </View>

              <View style={styles.tributeCopy}>
                <Text style={styles.tributeTitle}>Daily reward</Text>
                <View style={[styles.inlineGap, { marginTop: 3 }]}>
                  {nextReward?.energy
                    ? <Zap color={colors.gold} size={13} fill={colors.gold} />
                    : <Star color={colors.accent} size={13} fill={colors.accent} />}
                  <Text style={styles.tributeReward}>{describeReward(nextReward)}</Text>
                </View>
                <Text style={styles.tributeNote}>
                  {rewardClaimedToday ? 'Come back tomorrow for more' : `Day ${nextDay} of 7`}
                </Text>
              </View>

              <Press
                scale={0.94}
                onPress={handleClaimReward}
                disabled={rewardClaimedToday || claiming}
                accessibilityLabel={rewardClaimedToday ? 'Already collected today' : `Claim ${describeReward(nextReward)}`}
              >
                {rewardClaimedToday ? (
                  <View style={styles.claimedPill}>
                    <CircleCheck color={colors.textMuted} size={14} />
                    <Text style={styles.claimedText}>Claimed</Text>
                  </View>
                ) : (
                  <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.claimBtn}>
                    <Text style={styles.claimText}>{claiming ? 'Claiming…' : 'Claim'}</Text>
                  </LinearGradient>
                )}
              </Press>

              <View style={[styles.freeTag, rewardClaimedToday && styles.freeTagDone]}>
                <Text style={[styles.freeTagText, rewardClaimedToday && styles.freeTagTextDone]}>
                  {rewardClaimedToday ? 'CLAIMED' : 'FREE'}
                </Text>
              </View>
            </View>

            {dailyDeals.length > 0 ? (
              <View style={styles.dealRow}>{dailyDeals.slice(0, 3).map(renderDealCard)}</View>
            ) : null}
          </FadeIn>
        </View>

        <View onLayout={trackSection('boosters')}>
          <FadeIn index={1}>
            <SectionHead
              title="BOOSTERS"
              note="One-time boosts for your XP, energy and streak"
            />
            {POWERUPS.map(renderBooster)}
          </FadeIn>
        </View>

        <View onLayout={trackSection('bundles')}>
          <FadeIn index={2}>
            <SectionHead
              title="ENERGY PACKS"
              note="Top up your balance"
              right={<Text style={styles.soon}>Coming soon</Text>}
            />
            <View style={styles.packRow}>
              {ENERGY_PACKS.map((pack) => (
                <Press
                  key={pack.id}
                  scale={0.96}
                  style={[styles.pack, pack.featured && styles.packFeatured]}
                  onPress={comingSoon}
                  accessibilityLabel={IAP_ENABLED ? `${pack.label}, ${pack.energy} energy, ${pack.price}` : `${pack.label}, ${pack.energy} energy, coming soon`}
                >
                  {pack.tag ? (
                    <View style={[styles.packTag, pack.cool && styles.packTagCool]}>
                      <Text style={[styles.packTagText, pack.cool && styles.packTagTextCool]}>{pack.tag.toUpperCase()}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.packLabel}>{pack.label.toUpperCase()}</Text>
                  <View style={[styles.packOrb, pack.featured && styles.packOrbFeatured]}>
                    <Zap
                      color={pack.cool ? colors.accent : colors.gold}
                      fill={pack.cool ? colors.accent : colors.gold}
                      size={22}
                    />
                  </View>
                  <View style={styles.inlineTight}>
                    <Text style={styles.packAmount}>{pack.energy.toLocaleString()}</Text>
                    <Zap color={colors.gold} size={13} fill={colors.gold} />
                  </View>

                  {pack.featured ? (
                    <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.packBuy, styles.packBuyGold]}>
                      <Text style={styles.packBuyTextGold}>{IAP_ENABLED ? pack.price : 'Soon'}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.packBuy}>
                      <Text style={styles.packBuyText}>{IAP_ENABLED ? pack.price : 'Soon'}</Text>
                    </View>
                  )}
                </Press>
              ))}
            </View>
          </FadeIn>
        </View>

        <View onLayout={trackSection('prestige')}>
          <FadeIn index={3}>
            <SectionHead
              title="COSMETICS"
              note="Frames, rings, badges and titles"
              right={
                <Press scale={0.95} onPress={() => setWardrobeOpen((open) => !open)} accessibilityLabel={wardrobeOpen ? 'Show fewer cosmetics' : 'See all cosmetics'}>
                  <Text style={styles.link}>{wardrobeOpen ? 'Show less' : 'See all'}</Text>
                </Press>
              }
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
              snapToInterval={cardWidth + 12}
              decelerationRate="fast"
            >
              {prestige.map(({ item, type, kind }) => renderPrestigeCard(item, type, kind, cardWidth))}
            </ScrollView>

            {wardrobeOpen ? WARDROBE.map((shelf) => (
              <View key={shelf.key}>
                <Text style={styles.wardrobeHead}>{shelf.title}</Text>
                <View style={styles.wardrobeGrid}>
                  {shelf.pick(catalogue).map((item) => renderPrestigeCard(item, shelf.key, shelf.kind, cardWidth))}
                </View>
              </View>
            )) : null}
          </FadeIn>
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inlineGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineTight: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  textShort: { color: colors.textFaint },
  cardShort: { backgroundColor: '#151722' },

  // --- Header ---
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, marginTop: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  titleBlock: { flexShrink: 0 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 30, letterSpacing: -0.6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success, marginTop: 6 },
  restockLabel: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  restockTime: { color: colors.gold, fontSize: 13, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] },

  wallet: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end',
    alignItems: 'center', gap: 6, marginTop: 8,
  },
  xpChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: 10, height: 32,
  },
  xpText: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  energyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.goldBorder,
    borderRadius: 999, paddingLeft: 10, paddingRight: 4, height: 32,
  },
  energyText: { color: colors.goldLight, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  plus: {
    width: 24, height: 24, borderRadius: 12, marginLeft: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold,
  },

  // --- Chips ---
  chipBar: { flexGrow: 0 },
  chips: { paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 40, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: colors.onGold, fontWeight: '700' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: TAB_BAR_CLEARANCE + 20 },

  // --- Sections ---
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 12, gap: 12 },
  sectionCopy: { flexShrink: 1 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: 1.1 },
  sectionNote: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  goldTime: { color: colors.gold, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  link: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  soon: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },

  // --- Featured bundle ---
  hero: {
    marginTop: 6, borderRadius: 22, borderWidth: 1, borderColor: colors.goldBorder,
    padding: 16, overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.goldSoft,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  heroLabelText: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  timePillText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  heroBody: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  heroCopy: { flex: 1, paddingRight: 8 },
  heroTitle: { color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 24, letterSpacing: -0.4 },
  heroPerks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  heroEnergy: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textFaint },
  heroFreeze: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  heroPerk: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 8 },
  heroArt: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  heroWas: {
    position: 'absolute', top: -4, right: 0,
    color: colors.textFaint, fontSize: 12, fontWeight: '600', textDecorationLine: 'line-through',
  },
  heroPrice: {
    position: 'absolute', bottom: 2, right: -6,
    shadowColor: colors.gold, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  heroPriceFill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  heroPriceText: { color: colors.onGold, fontSize: 17, fontWeight: '800' },

  // --- Daily tribute ---
  tribute: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8,
    backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(222, 184, 102, 0.22)',
    borderRadius: 18, padding: 14, paddingTop: 18,
  },
  tributeDone: { borderColor: colors.border, backgroundColor: '#151722' },
  tributeIcon: {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.goldBorder,
  },
  tributeIconDone: { backgroundColor: colors.surface, borderColor: colors.border },
  tributeCopy: { flex: 1 },
  tributeTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  tributeReward: { color: colors.gold, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  tributeNote: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  claimBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  claimText: { color: colors.onGold, fontSize: 14, fontWeight: '800' },
  claimedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9,
  },
  claimedText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  freeTag: {
    position: 'absolute', top: -9, left: 14,
    backgroundColor: colors.gold, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  freeTagDone: { backgroundColor: colors.surfaceHigh },
  freeTagText: { color: colors.onGold, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  freeTagTextDone: { color: colors.textMuted },

  // --- Flash deals ---
  dealRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dealCard: {
    flex: 1, alignItems: 'center', padding: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18,
  },
  dealTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  discount: {
    borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.goldSoft,
    borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
  },
  discountText: { color: colors.gold, fontSize: 10, fontWeight: '800' },
  // LEGENDARY is the longest word on the narrowest card; it shrinks before it clips.
  rarity: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, flexShrink: 1, marginLeft: 4, textAlign: 'right' },
  dealIcon: {
    width: 48, height: 48, borderRadius: 14, marginTop: 12, marginBottom: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  dealName: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  dealNote: { color: colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
  dealPrice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    alignSelf: 'stretch', marginTop: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  // Struck through and muted: there to be compared against, not read.
  dealWas: { color: colors.textFaint, fontSize: 10, fontWeight: '600', textDecorationLine: 'line-through', marginRight: 2 },
  dealNow: { color: colors.text, fontSize: 13, fontWeight: '800' },
  ownedText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  // --- Boosters ---
  booster: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14,
  },
  boosterActive: { borderColor: 'rgba(222, 184, 102, 0.45)', backgroundColor: '#1E1D27' },
  boosterIcon: {
    width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  countBadge: {
    position: 'absolute', bottom: -6, right: -6, minWidth: 20,
    alignItems: 'center', backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
  },
  countText: { color: colors.onGold, fontSize: 9, fontWeight: '900' },
  boosterCopy: { flex: 1 },
  boosterName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  activeTag: { backgroundColor: colors.gold, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  activeTagText: { color: colors.onGold, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  boosterDesc: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  equipped: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.goldSoft,
    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7,
  },
  equippedText: { color: colors.gold, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  pricePillShort: { backgroundColor: colors.surface },
  pricePillText: { color: colors.text, fontSize: 13, fontWeight: '700' },

  // --- Energy packs ---
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  pack: {
    flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18,
  },
  // Lifted rather than recoloured: taller, gold rim, a faint warm cast.
  packFeatured: {
    paddingVertical: 22, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: '#1F1E27',
    shadowColor: colors.gold, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  packTag: {
    position: 'absolute', top: -9,
    backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  packTagCool: { backgroundColor: '#3F436D' },
  packTagText: { color: colors.onGold, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  packTagTextCool: { color: colors.calories },
  packLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },
  packOrb: {
    width: 50, height: 50, borderRadius: 25, marginVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  packOrbFeatured: { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder },
  packAmount: { color: colors.text, fontSize: 16, fontWeight: '800' },
  packBuy: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  packBuyGold: { borderWidth: 0 },
  packBuyText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  packBuyTextGold: { color: colors.onGold, fontSize: 13, fontWeight: '800' },

  // --- Prestige ---
  carousel: { marginHorizontal: -20 },
  carouselContent: { paddingHorizontal: 20, gap: 12 },
  prestige: {
    alignItems: 'center', padding: 14, paddingTop: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
  },
  prestigeEquipped: { borderColor: colors.goldBorder },
  halo: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accentBorder,
  },
  haloTag: {
    position: 'absolute', top: -10,
    backgroundColor: '#3F436D', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
  },
  haloTagText: { color: colors.calories, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  rarityTag: { backgroundColor: colors.surfaceHigh, borderWidth: 1 },
  prestigeName: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 12 },
  prestigeKind: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  prestigeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'stretch', marginTop: 12, paddingVertical: 9, borderRadius: 999,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  prestigeBtnEquipped: { borderColor: colors.goldBorder, backgroundColor: colors.goldSoft },
  prestigeBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  wardrobeHead: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginTop: 20, marginBottom: 10 },
  wardrobeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
