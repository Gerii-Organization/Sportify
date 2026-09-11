import { View } from 'react-native';
import { Zap, Circle, User, Shield, Crown, Swords, Ghost, Hexagon, Triangle, BatteryCharging, Trophy, Flame, Tag, Snowflake } from 'lucide-react-native';
import { colors } from '../theme';

/**
 * What a shop item looks like.
 *
 * Lifted out of ShopScreen, where it was a 130-line `renderVisualPreview`
 * closure. The purchase sheet needs the same drawing at twice the size, and a
 * second copy of seven ring treatments is exactly the kind of duplication that
 * left three screens rendering the expensive avatars as the default green.
 *
 * `scale` multiplies every dimension; 1 is the size the grid uses.
 */
export default function ItemPreview({ item, type, scale = 1 }) {
  const s = (n) => Math.round(n * scale);
  const box = { width: s(50), height: s(50), justifyContent: 'center', alignItems: 'center' };
  const centred = { position: 'absolute' };

  if (type === 'ring') {
    if (item.type === 'inferno') {
      return (
        <View style={box}>
          <Circle color={item.color} size={s(40)} strokeWidth={3} />
          <Flame color={colors.streak} size={s(20)} style={{ position: 'absolute', top: s(-10) }} />
          <Flame color={colors.streak} size={s(20)} style={{ position: 'absolute', bottom: s(-10), transform: [{ rotate: '180deg' }] }} />
        </View>
      );
    }
    if (item.type === 'cyber') {
      return (
        <View style={box}>
          <Hexagon color={item.color} size={s(44)} strokeWidth={2} />
          <Hexagon color="#FF00FF" size={s(34)} strokeWidth={1} style={centred} />
        </View>
      );
    }
    if (item.type === 'toxic') {
      return (
        <View style={box}>
          <Triangle color={item.color} size={s(46)} strokeWidth={3} />
          <Circle color={colors.onAccent} size={s(10)} style={centred} fill={item.color} />
        </View>
      );
    }
    if (item.type === 'pulse') {
      return (
        <View style={box}>
          <Circle color={item.color} size={s(40)} strokeWidth={2} />
          <Circle color={item.color} size={s(28)} strokeWidth={2} opacity={0.5} style={centred} />
        </View>
      );
    }
    if (item.type === 'diamond') {
      return (
        <View style={[box, { transform: [{ rotate: '45deg' }] }]}>
          <View style={{ width: s(32), height: s(32), borderWidth: 3, borderColor: item.color }} />
        </View>
      );
    }
    if (item.type === 'quantum') {
      return (
        <View style={box}>
          <Hexagon color={item.color} size={s(46)} strokeWidth={2} style={{ transform: [{ rotate: '30deg' }] }} />
          <Hexagon color={item.color} size={s(46)} strokeWidth={2} style={{ position: 'absolute', transform: [{ rotate: '60deg' }] }} />
        </View>
      );
    }
    return <Circle color={item.color} size={s(36)} strokeWidth={4} />;
  }

  if (type === 'avatar') {
    const frame = {
      width: s(48), height: s(48), borderRadius: s(24),
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.surface, borderWidth: 2,
    };

    if (item.type === 'royal') {
      return (
        <View style={[frame, { borderColor: item.color, borderWidth: 3 }]}>
          <User color={colors.text} size={s(24)} />
          <Crown color={item.color} size={s(22)} style={{ position: 'absolute', top: s(-18) }} fill="rgba(255, 215, 0, 0.3)" />
        </View>
      );
    }
    if (item.type === 'demon' || item.type === 'inferno_avatar') {
      return (
        <View style={[frame, { borderColor: item.color, borderStyle: item.type === 'demon' ? 'dashed' : 'solid', shadowColor: item.color, shadowOpacity: 0.8, shadowRadius: 8 }]}>
          <User color={colors.text} size={s(24)} />
          <Flame color={item.color} size={s(30)} style={{ position: 'absolute', opacity: 0.4, zIndex: -1 }} />
        </View>
      );
    }
    if (item.type === 'glitch') {
      return (
        <View style={[frame, { borderColor: item.color, borderRadius: s(12) }]}>
          <User color="#00EAFF" size={s(26)} style={{ marginLeft: -2 }} />
          <User color="#FF00FF" size={s(26)} style={{ position: 'absolute', opacity: 0.7, marginLeft: 2 }} />
        </View>
      );
    }
    if (item.type === 'holo') {
      return (
        <View style={[frame, { borderColor: item.color, shadowColor: item.color, shadowOpacity: 1, shadowRadius: 15 }]}>
          <User color={item.color} size={s(24)} />
        </View>
      );
    }
    if (item.type === 'void') {
      return (
        <View style={[frame, { borderColor: item.color, borderWidth: 4, shadowColor: '#fff', shadowOpacity: 0.2, shadowRadius: 5 }]}>
          <User color={colors.textDisabled} size={s(24)} />
        </View>
      );
    }
    return (
      <View style={[frame, { borderColor: '#444' }]}>
        <User color={colors.text} size={s(24)} />
      </View>
    );
  }

  if (type === 'badge') {
    const BADGE_ICONS = { Swords, Ghost, Crown, Shield };
    const Glyph = BADGE_ICONS[item.icon] || Shield;

    return (
      <View style={[box, { backgroundColor: `${item.color}22`, borderRadius: s(28) }]}>
        <Glyph color={item.color} size={s(32)} />
      </View>
    );
  }

  if (type === 'title') {
    return (
      <View style={[box, { backgroundColor: colors.accentSoft, borderRadius: s(18) }]}>
        <Tag color={colors.accent} size={s(32)} />
      </View>
    );
  }

  if (type === 'powerup') {
    const POWERUP_ICONS = { Zap, Trophy, Flame, Snowflake, BatteryCharging };
    const Glyph = POWERUP_ICONS[item.icon] || BatteryCharging;

    return (
      <View style={[box, { backgroundColor: `${item.color}15`, borderRadius: s(18), padding: s(10) }]}>
        <Glyph color={item.color} size={s(38)} />
      </View>
    );
  }

  return null;
}
