/**
 * Invite codes and links (roadmap S3). The rules — who gets paid, when, how
 * much — are on the server (20260917_invites.sql); this is only the text.
 *
 * A link looks like `sportify://invite/K7MPQ2X`. It needs the `scheme` in
 * app.json, which only takes effect in a rebuilt app; the code itself works
 * without it, typed into the sign-up screen.
 */

export const INVITE_BONUS = 250;

const CODE_ALPHABET = /[^A-Z0-9]/g;

/** Uppercase, letters and digits only, so "k7mp-q2x " matches K7MPQ2X. */
export function normaliseCode(input) {
  return String(input || '').toUpperCase().replace(CODE_ALPHABET, '').slice(0, 12);
}

export const inviteUrl = (code) => `sportify://invite/${normaliseCode(code)}`;

/** The code from an invite link, or null for any other URL. */
export function codeFromUrl(url) {
  const match = /^sportify:\/\/+invite\/([A-Za-z0-9-]+)/i.exec(String(url || ''));
  if (!match) return null;
  const code = normaliseCode(match[1]);
  return code.length >= 5 ? code : null;
}

/** What goes into the share sheet. The code is spelled out as well as linked. */
export function inviteMessage(code, firstName) {
  const clean = normaliseCode(code);
  const from = firstName ? `${firstName} invited you` : 'You are invited';
  return `${from} to train on Sportify. Sign up with code ${clean} and we both get ${INVITE_BONUS} energy after your first workout.\n${inviteUrl(clean)}`;
}

/** Plain-language reasons from redeem_invite, for the sign-up screen. */
export const REDEEM_ERRORS = {
  unknown_code: 'That invite code does not exist. Check it and try again.',
  own_code: 'That is your own invite code.',
  already_redeemed: 'This account has already used an invite code.',
  too_late: 'Invite codes can only be used in the first two weeks of an account.',
};
