import { Text, TextInput, StyleSheet } from 'react-native';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

/**
 * Plus Jakarta Sans everywhere, without touching 140 files.
 *
 * The app writes `fontWeight: '700'` in its styles and never names a family,
 * so every screen renders in the system font. Rather than adding a family to
 * every style, `Text.render` and `TextInput.render` are wrapped once: the
 * style is flattened, the weight is read, and the matching font file is put on
 * as the family.
 *
 * It has to work that way because these are five separate files, not one
 * family with five weights — asking for `PlusJakartaSans_400Regular` at weight
 * 700 gives you regular on iOS and a smeared synthetic bold on Android. The
 * weight is dropped once the file is chosen, for the same reason.
 *
 * Styles the caller sets still win: the family is added underneath, so a
 * screen that names its own font keeps it.
 */

const FAMILIES = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
};

/** The nearest file for a React Native weight. 900 has no file, so it uses 800. */
export function familyForWeight(weight) {
  if (weight === 'bold') return FAMILIES[700];
  const n = parseInt(weight, 10);
  if (!Number.isFinite(n)) return FAMILIES[400];
  if (n >= 800) return FAMILIES[800];
  if (n >= 700) return FAMILIES[700];
  if (n >= 600) return FAMILIES[600];
  if (n >= 500) return FAMILIES[500];
  return FAMILIES[400];
}

let patched = false;

/** Wraps Text and TextInput once. Safe to call again. */
export function applyAppFont() {
  if (patched) return;
  patched = true;

  for (const Component of [Text, TextInput]) {
    const original = Component.render;
    if (typeof original !== 'function') continue;

    Component.render = function renderWithFont(props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      const style = [
        { fontFamily: familyForWeight(flat.fontWeight) },
        props.style,
        // Cleared last: the file already carries the weight.
        { fontWeight: undefined },
      ];
      return original.call(this, { ...props, style }, ref);
    };
  }
}

/** True once the five files are in memory. */
export function useAppFont() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  return loaded;
}
