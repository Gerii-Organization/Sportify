/**
 * Where the app points people for the things that live on the web.
 *
 * Both stores require a reachable privacy policy URL on the listing, and Apple
 * wants one inside the app as well. Keeping them here means the settings menu
 * never hardcodes a URL that later moves.
 *
 * The pages are in `docs/` in this repo, ready to serve from GitHub Pages.
 * Replace the host below with wherever you publish them.
 */

const SITE = 'https://REPLACE-ME.github.io/sportify';

export const PRIVACY_URL = `${SITE}/privacy.html`;
export const DELETE_ACCOUNT_URL = `${SITE}/delete-account.html`;

/** True once the placeholder above has been replaced with a real host. */
export const LINKS_CONFIGURED = !SITE.includes('REPLACE-ME');
