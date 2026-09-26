/**
 * Avatar frame artwork, as data.
 *
 * Each frame is a list of SVG shapes on a 200 × 200 box with the avatar's
 * circle centred in it at radius 70, so the ornaments live in the band between
 * 70 and 100. Kept as plain data rather than JSX so that two renderers can draw
 * the same geometry: FrameArt.js on the phone, and a node script that turns it
 * into SVG text for design previews — the art is checked in a browser without
 * rebuilding the app, and what is checked is exactly what ships.
 *
 * A node is `{ tag, props, children? }`, with react-native-svg's component
 * names and camelCase props. Nothing here imports React Native.
 *
 * Every frame has a compact version for small avatars (list rows, chat
 * headers): the same ring, fewer ornaments, nothing that reaches into the
 * next row.
 */

const C = 100;
/** The avatar's radius inside the 200-unit art box. */
export const AVATAR_R = 70;
/** Art box side ÷ avatar diameter. */
export const ART_SCALE = 100 / AVATAR_R;
/** Avatars smaller than this get the compact art. */
export const COMPACT_BELOW = 64;

const round = (n) => Math.round(n * 10) / 10;

/** A point at radius r, `deg` clockwise from 12 o'clock. */
export function polar(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [round(C + r * Math.sin(a)), round(C - r * Math.cos(a))];
}

const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ');
const at = ([x, y]) => `${x} ${y}`;

const ring = (r, props) => ({ tag: 'Circle', props: { cx: C, cy: C, r, fill: 'none', ...props } });

const linear = (id, stops, dir = { x1: '0', y1: '0', x2: '0', y2: '1' }) => ({
  tag: 'LinearGradient',
  props: { id, ...dir },
  children: stops.map(([offset, stopColor]) => ({ tag: 'Stop', props: { offset: String(offset), stopColor } })),
});

/** An arc along radius r from angle `from` to `to`, in whichever direction `to` lies. */
export function arcPath(r, from, to) {
  const sweep = to > from ? 1 : 0;
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${at(polar(r, from))} A${r} ${r} 0 ${large} ${sweep} ${at(polar(r, to))}`;
}

// --- Circuit ---------------------------------------------------------------

function circuit(compact) {
  const nodes = [30, 90, 150, 210, 270, 330];
  const shapes = [ring(71, { stroke: 'rgba(80, 220, 210, 0.35)', strokeWidth: 1 })];

  if (!compact) {
    shapes.push(ring(88, { stroke: '#3FD0C9', strokeWidth: 2, strokeDasharray: '10 16', strokeOpacity: 0.55 }));
    for (const a of nodes) {
      const [x1, y1] = polar(79, a);
      const [x2, y2] = polar(93, a);
      shapes.push({ tag: 'Line', props: { x1, y1, x2, y2, stroke: '#3FD0C9', strokeWidth: 2 } });
      const [px, py] = polar(96, a);
      shapes.push({
        tag: 'Rect',
        props: { x: round(px - 3.5), y: round(py - 3.5), width: 7, height: 7, rx: 1.5, fill: '#8AF5EA', transform: `rotate(${a} ${px} ${py})` },
      });
    }
  }

  shapes.push(ring(77, { stroke: 'url(#circuit)', strokeWidth: 3.5 }));
  for (const a of nodes) {
    const [cx, cy] = polar(77, a);
    shapes.push({ tag: 'Circle', props: { cx, cy, r: compact ? 5 : 4.5, fill: '#0E1017', stroke: '#8AF5EA', strokeWidth: 2 } });
  }

  return { defs: [linear('circuit', [[0, '#8AF5EA'], [1, '#2BB3AE']])], shapes };
}

// --- Sakura ----------------------------------------------------------------

function blossom(cx, cy, size) {
  const petals = [];
  for (let k = 0; k < 5; k += 1) {
    const a = k * 72;
    const [px, py] = [round(cx + size * 0.55 * Math.sin((a * Math.PI) / 180)), round(cy - size * 0.55 * Math.cos((a * Math.PI) / 180))];
    petals.push({
      tag: 'Ellipse',
      props: {
        cx: px, cy: py, rx: round(size * 0.4), ry: round(size * 0.6),
        fill: 'url(#petal)', stroke: '#E07AA2', strokeWidth: 0.8, transform: `rotate(${a} ${px} ${py})`,
      },
    });
  }
  petals.push({ tag: 'Circle', props: { cx, cy, r: round(size * 0.22), fill: '#F6D55C' } });
  return petals;
}

function sakura(compact) {
  const spots = compact
    ? [[-40, 80, 16], [140, 80, 14]]
    : [[-40, 81, 15], [-68, 91, 10], [-13, 92, 9], [140, 81, 14], [167, 91, 9]];
  const shapes = [ring(76, { stroke: 'url(#sakura)', strokeWidth: 4 })];
  for (const [a, r, size] of spots) {
    const [x, y] = polar(r, a);
    shapes.push(...blossom(x, y, size));
  }
  return {
    defs: [linear('sakura', [[0, '#FAD3E1'], [1, '#E58AAE']]), linear('petal', [[0, '#FFE8F0'], [1, '#F4A9C4']])],
    shapes,
  };
}

// --- Frostbite ---------------------------------------------------------------

function sparkle(x, y, s) {
  const k = s * 0.18;
  return {
    tag: 'Path',
    props: {
      d: `M${x} ${y - s} Q${x + k} ${y - k} ${x + s} ${y} Q${x + k} ${y + k} ${x} ${y + s} Q${x - k} ${y + k} ${x - s} ${y} Q${x - k} ${y - k} ${x} ${y - s} Z`,
      fill: '#FFFFFF',
    },
  };
}

function frost(compact) {
  const n = compact ? 8 : 12;
  const shapes = [ring(71, { stroke: 'rgba(200, 235, 255, 0.45)', strokeWidth: 1 })];
  for (let k = 0; k < n; k += 1) {
    const a = (k * 360) / n;
    const long = k % 2 === 0;
    const tip = compact ? 89 : long ? 98 : 89;
    const half = compact ? 6 : long ? 6.5 : 5;
    shapes.push({
      tag: 'Polygon',
      props: { points: pts([polar(78, a - half), polar(tip, a), polar(78, a + half)]), fill: 'url(#shard)', stroke: '#D6F1FF', strokeWidth: 0.6 },
    });
  }
  shapes.push(ring(76, { stroke: 'url(#frost)', strokeWidth: 5 }));
  if (!compact) {
    const [x, y] = polar(95, 45);
    shapes.push(sparkle(x, y, 7));
    const [x2, y2] = polar(93, 228);
    shapes.push(sparkle(x2, y2, 5));
  }
  return {
    defs: [linear('frost', [[0, '#F2FBFF'], [1, '#7FC6EE']]), linear('shard', [[0, '#FFFFFF'], [1, '#9ED6F5']])],
    shapes,
  };
}

// --- Laurel ------------------------------------------------------------------

/**
 * An almond-shaped leaf that starts at (x, y) and points along `dir` degrees
 * (screen angle: 0 is +x, clockwise positive, as SVG's rotate reads it).
 */
function leaf(x, y, dir, length, width) {
  const l = round(length);
  const w = round(width);
  return {
    tag: 'Path',
    props: {
      d: `M0 0 Q${round(l / 2)} ${-w} ${l} 0 Q${round(l / 2)} ${w} 0 0 Z`,
      fill: 'url(#leaf)', stroke: '#7A5E2A', strokeWidth: 0.7,
      transform: `translate(${x} ${y}) rotate(${round(dir)})`,
    },
  };
}

function laurel(compact) {
  const steps = compact ? 4 : 7;
  const stemR = 84;
  const length = compact ? 13 : 16;
  const width = compact ? 4 : 5;
  const shapes = [];

  // Two branches rising from the bottom to near the top. At each step on the
  // stem a pair of leaves opens either side of it, angled forward, the way a
  // wreath is bound. The stem's direction of growth is the tangent: the angle
  // itself on the left branch, which grows clockwise, and its opposite on the
  // right, which grows back the other way.
  const branch = (from, to) => {
    const rising = to > from;
    shapes.push({ tag: 'Path', props: { d: arcPath(stemR, from, to), stroke: '#A8843C', strokeWidth: compact ? 1.2 : 1.6, fill: 'none', strokeLinecap: 'round' } });
    for (let i = 0; i < steps; i += 1) {
      const a = from + ((to - from) * (i + 0.35)) / steps;
      const [x, y] = polar(stemR, a);
      const grow = rising ? a : a + 180;
      const out = rising ? -40 : 40;
      shapes.push(leaf(x, y, grow + out, length, width));
      shapes.push(leaf(x, y, grow - out, length * 0.92, width * 0.95));
    }
    // A single leaf at the tip, along the stem.
    const [tx, ty] = polar(stemR, to);
    shapes.push(leaf(tx, ty, rising ? to : to + 180, length * 0.9, width * 0.9));
  };

  branch(196, 336);
  branch(164, 24);
  shapes.push(ring(73, { stroke: 'url(#laurelGold)', strokeWidth: 3.2 }));

  if (!compact) {
    // The tie where the two branches meet, with two short ribbon tails.
    shapes.push({ tag: 'Polygon', props: { points: '97,186 89,198 94,197 99,190', fill: 'url(#laurelGold)', stroke: '#7A5E2A', strokeWidth: 0.7 } });
    shapes.push({ tag: 'Polygon', props: { points: '103,186 111,198 106,197 101,190', fill: 'url(#laurelGold)', stroke: '#7A5E2A', strokeWidth: 0.7 } });
    shapes.push({ tag: 'Circle', props: { cx: 100, cy: 185, r: 4.5, fill: 'url(#laurelGold)', stroke: '#7A5E2A', strokeWidth: 0.8 } });
  }

  return {
    defs: [
      linear('laurelGold', [[0, '#F5E6BE'], [0.5, '#E2C07A'], [1, '#B8913F']]),
      linear('leaf', [[0, '#EAD18F'], [1, '#A8843C']], { x1: '0', y1: '0', x2: '1', y2: '1' }),
    ],
    shapes,
  };
}

// --- Aurora ------------------------------------------------------------------

function aurora(compact) {
  const shapes = [
    ring(78, { stroke: 'url(#aurora)', strokeWidth: 13, strokeOpacity: 0.2 }),
    ring(76, { stroke: 'url(#aurora)', strokeWidth: 5 }),
    ring(71, { stroke: 'rgba(255, 255, 255, 0.22)', strokeWidth: 1 }),
  ];
  if (!compact) {
    for (const [r, from, to, width, opacity] of [[89, 20, 112, 2.2, 0.8], [94, 198, 252, 1.6, 0.55], [87, 284, 340, 1.6, 0.65]]) {
      shapes.push({ tag: 'Path', props: { d: arcPath(r, from, to), stroke: 'url(#aurora)', strokeWidth: width, strokeOpacity: opacity, strokeLinecap: 'round', fill: 'none' } });
      const [cx, cy] = polar(r, to);
      shapes.push({ tag: 'Circle', props: { cx, cy, r: round(width + 1.2), fill: '#FFFFFF', fillOpacity: opacity } });
    }
  }
  return {
    defs: [linear('aurora', [[0, '#5EE7C8'], [0.35, '#6FA8F0'], [0.7, '#B38CF0'], [1, '#F08CC8']], { x1: '0', y1: '0', x2: '1', y2: '1' })],
    shapes,
    // A ring that turns slowly. Symmetric enough to rotate as a whole; not in
    // lists, where fifty of them would turn at once for no one in particular.
    spin: !compact,
  };
}

// --- Phoenix -----------------------------------------------------------------

function flame(a, height, baseR = 75, half = 6) {
  const b1 = polar(baseR, a - half);
  const b2 = polar(baseR, a + half);
  const tip = polar(baseR + height, a);
  const c1 = polar(baseR + height * 0.55, a - half - 3);
  const c2 = polar(baseR + height * 0.55, a + half + 3);
  return {
    tag: 'Path',
    props: { d: `M${at(b1)} Q${at(c1)} ${at(tip)} Q${at(c2)} ${at(b2)} Z`, fill: 'url(#fire)', stroke: '#8A2A14', strokeWidth: 0.6 },
  };
}

function phoenix(compact) {
  const shapes = [];

  if (!compact) {
    // The left wing, drawn once and mirrored: four feathers rooted on the ring
    // that sweep up and out, longest at the top.
    const wing = [];
    [[250, 92, 16], [266, 97, 20], [282, 101, 24], [298, 104, 26]].forEach(([a, reach, lift]) => {
      const b1 = polar(76, a - 5);
      const b2 = polar(76, a + 5);
      const tip = polar(reach, a + lift);
      const c1 = polar((76 + reach) / 2 + 4, a - 2);
      const c2 = polar((76 + reach) / 2 - 2, a + lift * 0.8);
      wing.push({
        tag: 'Path',
        props: { d: `M${at(b1)} Q${at(c1)} ${at(tip)} Q${at(c2)} ${at(b2)} Z`, fill: 'url(#plume)', stroke: '#8A2A14', strokeWidth: 0.7 },
      });
    });
    shapes.push({ tag: 'G', props: {}, children: wing });
    shapes.push({ tag: 'G', props: { transform: 'translate(200, 0) scale(-1, 1)' }, children: wing });
  }

  shapes.push(ring(74, { stroke: 'url(#fire)', strokeWidth: 5 }));
  shapes.push(ring(70, { stroke: 'rgba(255, 190, 110, 0.35)', strokeWidth: 1 }));
  if (compact) {
    shapes.push(flame(0, 15));
  } else {
    shapes.push(flame(-14, 15), flame(14, 15), flame(0, 25));
  }

  return {
    defs: [
      linear('fire', [[0, '#FFE08A'], [0.55, '#FF9A3D'], [1, '#E0442C']]),
      linear('plume', [[0, '#FFD27A'], [1, '#E0442C']], { x1: '1', y1: '0', x2: '0', y2: '1' }),
    ],
    shapes,
  };
}

// --- Golden Apex (compact) -----------------------------------------------------
// The full frame is GoldenApexFrame.js, which animates; lists get this ring.

function apex() {
  return {
    defs: [linear('gilt', [[0, '#F5E6BE'], [0.35, '#E2C07A'], [0.7, '#B8913F'], [1, '#7A5E2A']])],
    shapes: [
      ring(80, { stroke: '#6D5A2D', strokeWidth: 1 }),
      ring(76, { stroke: 'url(#gilt)', strokeWidth: 7 }),
      ring(72, { stroke: '#6D5A2D', strokeWidth: 1 }),
      { tag: 'Polygon', props: { points: '86,26 90,14 96,22 100,8 104,22 110,14 114,26', fill: 'url(#gilt)', stroke: '#6D5A2D', strokeWidth: 1, strokeLinejoin: 'round' } },
      { tag: 'Polygon', props: { points: '100,15 103,20 100,25 97,20', fill: '#C0405E' } },
    ],
  };
}

const BUILDERS = { circuit, sakura, frost, laurel, aurora, phoenix, apex };

/** Frame types drawn as art rather than as a coloured border. */
export const FRAME_ART_TYPES = Object.keys(BUILDERS);

/** `{ defs, shapes, spin? }` for a frame type, or null for the border-only ones. */
export function frameArt(type, { compact = false } = {}) {
  const build = BUILDERS[type];
  return build ? build(compact) : null;
}
