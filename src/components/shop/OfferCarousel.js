import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Zap, Snowflake, Star, Lock } from 'lucide-react-native';
import { colors, gradients } from '../../theme';
import { getAvatar } from '../../constants/cosmetics';
import { offerContents } from '../../lib/offers';
import Avatar from '../Avatar';
import Press from '../Press';

/**
 * The real-money bundles, one card each, swiped through with page dots.
 *
 * Every card shows its exclusive frame on the viewer's own avatar — a frame on
 * a grey placeholder is a picture of a frame; on your own face it is a thing
 * you could have. The contents are listed line by line rather than summed into
 * a "value" figure: a value in euros is a price claim, and the shop does not
 * make price claims it cannot back.
 *
 * `purchasable` false (no store wired in yet) turns the button into a quiet
 * "Coming soon" with no price on it, as Apple requires.
 */
export default function OfferCarousel({ offers, profile, purchasable, priceFor, ownedFrames, onBuy, onLayoutCard }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 40;
  const [page, setPage] = useState(0);

  const onScroll = (event) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12));
    if (next !== page) setPage(next);
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.track}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={48}
      >
        {offers.map((offer, index) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            width={cardWidth}
            profile={profile}
            purchasable={purchasable}
            price={priceFor?.(offer)}
            owned={!!ownedFrames?.has(offer.frameId)}
            onBuy={() => onBuy(offer)}
            onLayout={onLayoutCard ? () => onLayoutCard(offer.id, index) : undefined}
          />
        ))}
      </ScrollView>

      {offers.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {offers.map((offer, i) => <View key={offer.id} style={[styles.dot, i === page && styles.dotOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

function OfferCard({ offer, width, profile, purchasable, price, owned, onBuy, onLayout }) {
  const frame = getAvatar(offer.frameId);
  const lines = offerContents(offer);
  const buyLabel = owned ? 'Owned' : purchasable && price ? price : 'Coming soon';

  return (
    <LinearGradient colors={gradients.goldCard} style={[styles.card, { width }]} onLayout={onLayout}>
      <View style={styles.top}>
        <View style={styles.label}>
          <Sparkles color={colors.gold} size={12} />
          <Text style={styles.labelText}>{offer.label.toUpperCase()}</Text>
        </View>
        {offer.oncePerAccount ? <Text style={styles.once}>Once per account</Text> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.copy}>
          <Text style={styles.name}>{offer.name}</Text>
          {lines.map((line) => <Line key={line.kind} line={line} frameName={frame.name} />)}
        </View>

        {/* The frame, worn. Golden Apex reaches well above its avatar (the
            crown), so the avatar sits low in a tall box. */}
        <View style={styles.art} accessibilityLabel={`${frame.name} frame, shown on your avatar`}>
          <View style={styles.artAvatar}>
            <Avatar profile={{ ...(profile || {}), equipped_avatar: offer.frameId }} size={64} />
          </View>
        </View>
      </View>

      <Press
        scale={0.97}
        onPress={onBuy}
        disabled={owned}
        accessibilityLabel={owned ? `${offer.name}, already yours` : purchasable && price ? `Buy ${offer.name} for ${price}` : `${offer.name}, coming soon`}
      >
        {purchasable && price && !owned ? (
          <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buy}>
            <Text style={styles.buyTextGold}>{buyLabel}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.buy, styles.buyQuiet]}>
            {owned ? null : <Lock color={colors.textFaint} size={14} />}
            <Text style={styles.buyText}>{buyLabel}</Text>
          </View>
        )}
      </Press>
    </LinearGradient>
  );
}

function Line({ line, frameName }) {
  if (line.kind === 'frame') {
    return (
      <View style={styles.line}>
        <Sparkles color={colors.gold} size={14} />
        <Text style={styles.lineText} numberOfLines={1}>{frameName} frame</Text>
        <View style={styles.exclusive}>
          <Text style={styles.exclusiveText}>EXCLUSIVE</Text>
        </View>
      </View>
    );
  }
  if (line.kind === 'energy') {
    return (
      <View style={styles.line}>
        <Zap color={colors.gold} size={14} fill={colors.gold} />
        <Text style={[styles.lineText, styles.gold]}>+{line.amount.toLocaleString()} energy</Text>
      </View>
    );
  }
  if (line.kind === 'freezes') {
    return (
      <View style={styles.line}>
        <Snowflake color={colors.accent} size={14} />
        <Text style={styles.lineText}>{line.count} streak freeze{line.count === 1 ? '' : 's'}</Text>
      </View>
    );
  }
  return (
    <View style={styles.line}>
      <Star color={colors.xp} size={14} fill={colors.xp} />
      <Text style={styles.lineText}>XP Boost · double XP for 24h</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -20 },
  track: { paddingHorizontal: 20, gap: 12 },

  card: {
    borderRadius: 22, borderWidth: 1, borderColor: colors.goldBorder,
    padding: 16, overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.goldSoft,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  labelText: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  once: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  body: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  copy: { flex: 1, gap: 7, paddingRight: 6 },
  name: { color: colors.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginBottom: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lineText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  gold: { color: colors.gold },
  exclusive: {
    borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: colors.gold,
  },
  exclusiveText: { color: colors.onGold, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },

  art: { width: 136, height: 142, alignItems: 'center' },
  artAvatar: { position: 'absolute', top: 46 },

  buy: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 46, borderRadius: 999, marginTop: 12,
  },
  buyQuiet: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buyText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  buyTextGold: { color: colors.onGold, fontSize: 16, fontWeight: '800' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh },
  dotOn: { width: 18, backgroundColor: colors.gold },
});
