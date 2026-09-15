import { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../lib/navigationRef';
import { codeFromUrl } from '../lib/invites';
import { setSetting } from '../lib/settings';

/**
 * Opens sign-up with the code filled in when the app is launched from an
 * invite link (`sportify://invite/CODE`, roadmap S3). Renders nothing.
 *
 * The code is also stored, so it survives the app being closed between
 * tapping the link and finishing sign-up. Someone already signed in is told
 * invites are for new accounts rather than being dropped onto a sign-up form.
 */
export default function InviteLinkHandler() {
  const { user, initializing } = useAuth();
  const handledInitial = useRef(false);
  const signedIn = useRef(!!user);
  signedIn.current = !!user;

  useEffect(() => {
    if (initializing) return undefined;

    const handle = (url) => {
      const code = codeFromUrl(url);
      if (!code) return;

      if (signedIn.current) {
        Alert.alert('You already have an account', 'Invite codes are for new accounts. Share your own from your profile.');
        return;
      }

      setSetting('pendingInvite', code);
      const open = () => navigationRef.navigate('AuthScreen', { inviteCode: code });
      if (navigationRef.isReady?.()) open();
      else setTimeout(open, 600);
    };

    // The launch URL is read once; later links arrive through the listener.
    if (!handledInitial.current) {
      handledInitial.current = true;
      Linking.getInitialURL().then(handle).catch(() => {});
    }
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, [initializing]);

  return null;
}
