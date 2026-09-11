import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * A handle on navigation from outside any screen.
 *
 * The active-workout bar is rendered as a sibling of the whole stack so it can
 * sit over every screen. That puts it outside every navigator, where
 * `useNavigation` has no context to read — this is the supported way to reach
 * navigation from there.
 *
 * Deliberately the only thing in this file. A module that hands out navigation
 * to anything that imports it is how screens start driving each other.
 */
export const navigationRef = createNavigationContainerRef();

/** The route on top right now, or null before the tree has mounted. */
export function currentRouteName() {
  if (!navigationRef.isReady()) return null;
  return navigationRef.getCurrentRoute()?.name ?? null;
}

export function navigate(name, params) {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
}
