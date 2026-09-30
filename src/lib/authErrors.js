/**
 * Supabase auth errors, as something a person can act on.
 *
 * The raw messages were shown under a title of "Error": "Invalid login
 * credentials", "User already registered", "Network request failed". Each is
 * accurate and none says what to do next. Matched on `code` first — stable
 * across versions — and on the message only for the network case, which has
 * no code because the request never reached the server.
 *
 * Returns `{ title, message }` for an Alert. `action: 'login'` marks the one
 * case where the answer is a different screen, not a second attempt.
 */
const BY_CODE = {
  invalid_credentials: {
    title: 'Wrong email or password',
    message: 'Check both and try again.',
  },
  email_not_confirmed: {
    title: 'Confirm your email first',
    message: 'Open the link we sent you, then log in.',
  },
  user_already_exists: {
    title: 'You already have an account',
    message: 'Log in with this email instead.',
    action: 'login',
  },
  email_exists: {
    title: 'You already have an account',
    message: 'Log in with this email instead.',
    action: 'login',
  },
  weak_password: {
    title: 'Choose a stronger password',
    message: 'Pick a longer one that is harder to guess.',
  },
  email_address_invalid: {
    title: 'Check your email',
    message: 'That address does not look right.',
  },
  validation_failed: {
    title: 'Check your email',
    message: 'That address does not look right.',
  },
  over_request_rate_limit: {
    title: 'Too many attempts',
    message: 'Wait a minute, then try again.',
  },
  over_email_send_rate_limit: {
    title: 'Too many attempts',
    message: 'Wait a few minutes, then try again.',
  },
  signup_disabled: {
    title: 'Sign-ups are paused',
    message: 'New accounts cannot be created right now. Try again later.',
  },
  user_banned: {
    title: 'This account is suspended',
    message: 'Contact support if you think this is a mistake.',
  },
};

const NETWORK = {
  title: 'No connection',
  message: 'Check your internet connection and try again.',
};

const FALLBACK = {
  title: 'Something went wrong',
  message: 'Try again in a moment.',
};

export function authErrorMessage(error) {
  if (!error) return FALLBACK;
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];

  const text = String(error.message || '');
  if (error.name === 'AuthRetryableFetchError' || /network request failed|failed to fetch/i.test(text)) {
    return NETWORK;
  }
  // Older servers answered without a code.
  if (/invalid login credentials/i.test(text)) return BY_CODE.invalid_credentials;
  if (/already registered/i.test(text)) return BY_CODE.user_already_exists;
  return FALLBACK;
}
