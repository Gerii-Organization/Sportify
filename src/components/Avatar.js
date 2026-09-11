import { View, Image } from 'react-native';
import { User, Crown, Flame } from 'lucide-react-native';
import { colors, levelTiers } from '../theme';
import { getAvatar } from '../constants/cosmetics';
import { levelFromXp } from '../lib/level';

/**
 * The one avatar renderer.
 *
 * Five near-identical copies of this used to live in DashboardScreen,
 * FriendsScreen, ChatScreen, LeaderboardScreen and PublicProfileScreen. They
 * had drifted: only the Dashboard copy knew about the three most expensive
 * avatar themes, so a friend's Holographic or Void border showed up as plain
 * green everywhere else.
 *
 * Props:
 *   profile    A profile row. `equipped_avatar`, `xp` and `avatar_url` are the
 *              fields used. A photo replaces the glyph and keeps the border —
 *              the cosmetic frame is what people paid for, the face is what
 *              they want shown inside it.
 *   size       Outer diameter in points.
 *   rank       Optional leaderboard position; 1-3 add a coloured crown.
 *   muted      Render in the signed-out grey state.
 */
export default function Avatar({ profile, size = 46, rank, muted = false }) {
  const iconSize = size * 0.5;
  const theme = getAvatar(profile?.equipped_avatar);
  const level = levelFromXp(profile?.xp);

  let strokeColor = muted ? colors.textFaint : theme.color;
  let borderWidth = 1;
  let extra = {};

  if (!muted) {
    if (theme.type === 'holo') {
      borderWidth = 2;
      extra = { shadowColor: theme.color, shadowOpacity: 1, shadowRadius: 15 };
    } else if (theme.type === 'inferno_avatar') {
      borderWidth = 2;
      extra = { shadowColor: theme.color, shadowOpacity: 0.8, shadowRadius: 8 };
    } else if (theme.type === 'void') {
      borderWidth = 3;
      extra = { shadowColor: colors.text, shadowOpacity: 0.2, shadowRadius: 5 };
    } else {
      // Standard themes take their border from the user's level bracket.
      const tier = levelTiers.find((t) => level >= t.minLevel);
      if (tier) {
        strokeColor = tier.color;
        borderWidth = tier.borderWidth;
        if (tier.glow) extra = { shadowColor: tier.color, shadowOpacity: 0.8, shadowRadius: 10 };
      }
    }
  }

  // Signed-out renders the glyph whoever it is: the muted state is about the
  // app not knowing who you are, and a face would contradict that.
  const photo = muted ? null : profile?.avatar_url || null;

  const rankCrown = rank === 1 ? colors.energy : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : null;
  const iconColor = muted ? colors.textSecondary : theme.type === 'glitch' ? '#00EAFF' : theme.color;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: theme.type === 'glitch' && !muted ? size / 4 : size / 2,
          borderColor: strokeColor,
          borderWidth,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          // Visible, so crowns and flames can sit outside the circle. The photo
          // is clipped by its own borderRadius instead.
          overflow: 'visible',
        },
        extra,
        !muted && theme.type === 'demon' && { borderStyle: 'dashed' },
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          // Inset by the border so the frame stays a frame rather than being
          // covered by the photo's corner.
          style={{
            width: size - borderWidth * 2,
            height: size - borderWidth * 2,
            borderRadius: theme.type === 'glitch' && !muted ? size / 4 : size / 2,
          }}
          resizeMode="cover"
        />
      ) : (
        <User size={iconSize} color={iconColor} />
      )}

      {!muted && theme.type === 'royal' && (
        <Crown color={theme.color} size={iconSize * 0.8} fill="rgba(255, 215, 0, 0.3)" style={{ position: 'absolute', top: -size * 0.22 }} />
      )}
      {!muted && (theme.type === 'demon' || theme.type === 'inferno_avatar') && (
        <Flame color={theme.color} size={size * 0.8} style={{ position: 'absolute', opacity: 0.3, zIndex: -1 }} />
      )}
      {!muted && theme.type === 'glitch' && (
        <User size={iconSize} color="#FF00FF" style={{ position: 'absolute', opacity: 0.5, marginLeft: 6 }} />
      )}
      {rankCrown && (
        <Crown color={rankCrown} size={size * 0.43} fill={rankCrown} style={{ position: 'absolute', top: -size * 0.3, left: -size * 0.13, transform: [{ rotate: '-15deg' }] }} />
      )}
    </View>
  );
}
