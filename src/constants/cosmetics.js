/**
 * Every cosmetic item in the game, defined once.
 *
 * This replaces four separate `AVATAR_THEMES` maps that had drifted apart:
 * DashboardScreen knew about avatars a1-a7, while FriendsScreen, ChatScreen and
 * LeaderboardScreen only knew a1-a4. The practical effect was that the three
 * most expensive avatars rendered as the default green to everyone except the
 * person who bought them.
 *
 * The shop catalogue and the rendering themes are now the same data, so a new
 * item can never exist in one place and be missing from the other.
 */

import { colors } from '../theme';

/**
 * Progress ring themes.
 *
 * `points` is the SVG polygon for non-circular rings, drawn on a 100x100
 * viewBox. `perimeter` is that shape's outline length, used as the
 * strokeDasharray so the progress animation ends exactly at the start point.
 */
export const RINGS = [
  { id: 'r1', name: 'Standard Flow',  price: 0,    type: 'standard', color: colors.accent, perimeter: 283, points: null },
  { id: 'r2', name: 'Hellfire Ring',  price: 800,  type: 'inferno',  color: '#FF3300',     perimeter: 283, points: null },
  { id: 'r3', name: 'Cyber Hex',      price: 1200, type: 'cyber',    color: '#00EAFF',     perimeter: 268, points: '50,5 90,25 90,75 50,95 10,75 10,25' },
  { id: 'r4', name: 'Toxic Triangle', price: 1500, type: 'toxic',    color: '#39FF14',     perimeter: 274, points: '50,5 95,85 5,85' },
  { id: 'r5', name: 'Neon Pulse',     price: 2000, type: 'pulse',    color: '#FF00AA',     perimeter: 283, points: null },
  { id: 'r6', name: 'Golden Diamond', price: 2500, type: 'diamond',  color: '#FFD700',     perimeter: 255, points: '50,5 95,50 50,95 5,50' },
  { id: 'r7', name: 'Quantum Core',   price: 3500, type: 'quantum',  color: '#7400FF',     perimeter: 302, points: '30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30' },
];

/** Avatar border themes. */
export const AVATARS = [
  { id: 'a1', name: 'Clean Cut',       price: 0,    type: 'standard',       color: colors.accent },
  { id: 'a2', name: 'Golden King',     price: 1500, type: 'royal',          color: '#FFD700' },
  { id: 'a3', name: 'Demon Aura',      price: 2000, type: 'demon',          color: '#9900FF' },
  { id: 'a4', name: 'Electric Glitch', price: 2500, type: 'glitch',         color: '#FF00FF' },
  { id: 'a5', name: 'Holographic',     price: 3000, type: 'holo',           color: '#00FFFF' },
  { id: 'a6', name: 'Hellfire',        price: 3500, type: 'inferno_avatar', color: '#FF4400' },
  { id: 'a7', name: 'The Void',        price: 5000, type: 'void',           color: '#333333' },
];

export const BADGES = [
  { id: 'b1', name: 'Rookie',   price: 0,    icon: 'Shield', color: '#888888' },
  { id: 'b2', name: 'Spartan',  price: 1000, icon: 'Swords', color: '#FF4444' },
  { id: 'b3', name: 'Phantom',  price: 3000, icon: 'Ghost',  color: '#00EAFF' },
  { id: 'b4', name: 'Overlord', price: 5000, icon: 'Crown',  color: '#FFD700' },
];

/** Titles are keyed by their own text — that is what gets stored on the profile. */
export const TITLES = [
  { id: 'Gym Rat',     price: 100,  desc: 'For the dedicated' },
  { id: 'Beast Mode',  price: 250,  desc: 'Unleash the beast' },
  { id: 'Iron Lifter', price: 500,  desc: 'Heavy weights only' },
  { id: 'Olympian',    price: 1000, desc: 'God-like status' },
];

export const POWERUPS = [
  { id: 'p3', name: 'Coin Boost',     desc: '+50% energy on your next workout', price: 50,   icon: 'Zap',      color: '#FFC93C' },
  { id: 'p4', name: 'Streak Freeze',  desc: 'Forgives one missed day',          price: 400,  icon: 'Snowflake', color: '#8FA0FF' },
  { id: 'p1', name: 'XP Boost',       desc: 'Double XP for 24 hours',           price: 600,  icon: 'Trophy',   color: '#FFC93C' },
  { id: 'p2', name: 'Streak Restore', desc: 'Brings back a streak you lost',    price: 1000, icon: 'Flame',    color: '#FF8A2B' },
];

/** Default ids used when a profile has nothing equipped. */
export const DEFAULT_RING_ID = 'r1';
export const DEFAULT_AVATAR_ID = 'a1';

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

const RING_BY_ID = byId(RINGS);
const AVATAR_BY_ID = byId(AVATARS);

/** Look up an equipped ring, falling back to the free default. */
export function getRing(id) {
  return RING_BY_ID[id] || RING_BY_ID[DEFAULT_RING_ID];
}

/** Look up an equipped avatar, falling back to the free default. */
export function getAvatar(id) {
  return AVATAR_BY_ID[id] || AVATAR_BY_ID[DEFAULT_AVATAR_ID];
}
