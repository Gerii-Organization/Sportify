import { Image as RNImage } from 'react-native';

/**
 * A remote image that is cached to memory and disk (roadmap Q5).
 *
 * React Native's Image re-downloads avatars on every list scroll and keeps no
 * disk cache on Android, so a friends list or the leaderboard flickers faces
 * in each time it is opened. expo-image caches both ways and fades images in
 * instead of popping them.
 *
 * expo-image is a native module, and a JS bundle that imports it on a binary
 * built before it was added crashes at startup. So it is looked up the same
 * way notify.js looks up expo-notifications: a non-throwing probe first, and
 * plain Image when the native side is not there. After a rebuild the cache
 * simply starts working; before one, nothing breaks.
 *
 * Props follow React Native's Image (`source`, `style`, `resizeMode`) so a
 * swap is a rename.
 */

let ExpoImage;
try {
  // eslint-disable-next-line global-require
  const { requireOptionalNativeModule } = require('expo-modules-core');
  if (requireOptionalNativeModule('ExpoImage')) {
    // eslint-disable-next-line global-require
    ExpoImage = require('expo-image').Image;
  }
} catch {
  ExpoImage = undefined;
}

const FIT = { cover: 'cover', contain: 'contain', stretch: 'fill', center: 'none' };

export default function CachedImage({ source, style, resizeMode = 'cover', recyclingKey, accessibilityLabel, ...rest }) {
  if (!source?.uri && typeof source !== 'number') return null;

  if (ExpoImage) {
    return (
      <ExpoImage
        source={source}
        style={style}
        contentFit={FIT[resizeMode] || 'cover'}
        cachePolicy="memory-disk"
        transition={150}
        // Lists reuse cells; without a key a recycled cell briefly shows the
        // previous person's face.
        recyclingKey={recyclingKey || source?.uri}
        accessibilityLabel={accessibilityLabel}
        {...rest}
      />
    );
  }

  return <RNImage source={source} style={style} resizeMode={resizeMode} accessibilityLabel={accessibilityLabel} {...rest} />;
}
