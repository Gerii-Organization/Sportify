/**
 * What to load on each side of the bar.
 *
 * Standing at the rack working out that 87.5kg means a 20kg bar plus 15 + 10 +
 * 5 + 2.5 per side is the one bit of arithmetic every session demands, and the
 * app already knows the target weight for every set.
 *
 * Metric gym plates, heaviest first. Greedy works here — each plate is at least
 * double the next once you account for pairs, so taking the biggest that fits
 * never strands a remainder a smaller combination could have used.
 */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Common bars. The 20kg Olympic bar is the default in most gyms. */
export const BARS_KG = [20, 15, 10, 0];

/**
 * Splits a target into per-side plates.
 *
 * Returns `{ perSide, achievable, remainder }`. `achievable` is what the plates
 * actually add up to, which is not always the target — 47kg on a 20kg bar
 * leaves 13.5 per side, and 1.25 is the smallest plate, so you land on 46.25
 * and 0.75 is left over. Reporting the achievable weight is more useful than
 * silently rounding, because the number gets logged as the set.
 */
export function platesFor(targetKg, barKg = 20) {
  const target = Number(targetKg) || 0;
  const bar = Number(barKg) || 0;

  if (target <= bar) {
    return { perSide: [], achievable: bar, remainder: Math.max(0, target - bar), tooLight: target < bar };
  }

  let perSideKg = (target - bar) / 2;
  const perSide = [];

  for (const plate of PLATES_KG) {
    while (perSideKg >= plate - 1e-9) {
      perSide.push(plate);
      perSideKg -= plate;
    }
  }

  const loaded = perSide.reduce((t, p) => t + p, 0);

  return {
    perSide,
    achievable: bar + loaded * 2,
    // Floating point: 13.5 - 10 - 2.5 - 1.25 lands on 2.2e-16, not 0.
    remainder: Math.round(perSideKg * 2 * 100) / 100,
    tooLight: false,
  };
}

/** `[[25, 2], [10, 1]]` — plate and how many, for drawing a stack. */
export function groupPlates(perSide) {
  const counts = new Map();
  perSide.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
  return [...counts.entries()];
}
