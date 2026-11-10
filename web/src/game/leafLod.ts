/**
 * Leaf level of detail: which of a grove's leaves a season keeps, and how many a
 * far grove draws. Pure, so the tests can run it; Trees.tsx applies it.
 */

/** A leaf's place in [0, 1); mixes adjacent indices, since the old sequence kept almost every early winter leaf. */
export function leafHash(i: number): number {
  return ((Math.imul(i + 1, 1664525) ^ Math.imul(i + 7, 1013904223)) >>> 0) / 4294967296;
}

/**
 * A grove's leaves as instance slots, in order of leafHash. The season keeps the
 * leaves whose hash is under its density, so they fill a prefix of the slots, and
 * cutting the instance count from the tail thins every tree in the grove evenly.
 */
export function leafOrder(leafStart: number, leafCount: number): Uint32Array {
  const hash = new Float64Array(leafCount);
  for (let n = 0; n < leafCount; n++) hash[n] = leafHash(leafStart + n);
  const order = new Uint32Array(leafCount);
  for (let n = 0; n < leafCount; n++) order[n] = n;
  return order.sort((a, b) => hash[a]! - hash[b]!);
}

/**
 * The fraction of a grove's leaves drawn at an edge distance in metres: all of
 * them within `full`, then falling as 1 / distance, as a leaf's size on screen
 * does, down to `floor`. Cuts the shadow pass too, where far groves cost most.
 */
export function leafFraction(dist: number, full: number, floor: number): number {
  if (dist <= full) return 1;
  return Math.max(floor, full / dist);
}

/** In god's eye, groves within this many metres of the camera draw every leaf. */
export const GOD_LEAF_FULL = 45;
/** The most a far leaf is enlarged in god's eye; so a grove keeps at least 1 / GOD_LEAF_MAX_SCALE² of its leaves. */
export const GOD_LEAF_MAX_SCALE = 3;

/**
 * God's eye: the share of a grove's leaves to draw at a distance, and how much
 * to enlarge each so the crown covers as much of the screen. A leaf's area on
 * screen falls as 1 / distance², so that share, each leaf scaled by
 * 1 / sqrt(share), keeps the leaf area the eye sees. Cutting the count alone,
 * as leafFraction does nearer the ground, would bare the forest seen from
 * above. The technique is Solstice's, after Nanite's foliage
 * (github.com/SamG-Coder/solstice, MIT).
 *
 * :param distance: Metres from the camera to the nearest point of the grove.
 * :returns: `fraction` in (0, 1] and `scale` >= 1, with fraction * scale² = 1.
 */
export function godLeafLod(distance: number): { fraction: number; scale: number } {
  if (!(distance > GOD_LEAF_FULL)) return { fraction: 1, scale: 1 };
  const fraction = Math.max((GOD_LEAF_FULL / distance) ** 2, 1 / GOD_LEAF_MAX_SCALE ** 2);
  return { fraction, scale: 1 / Math.sqrt(fraction) };
}

/** Camera heights above the crowns, metres, between which god's-eye thinning eases in from the ground's. */
export const GOD_BLEND_LOW = 25;
export const GOD_BLEND_HIGH = 90;

/**
 * God's eye, eased into the ground's thinning by the camera's height, so that
 * the dive down to the cart and the climb back up change nothing at the
 * moment the view switches: at or below GOD_BLEND_LOW above the crowns it is
 * exactly the ground's `fraction` at full size, at or above GOD_BLEND_HIGH
 * it is godLeafLod, and in between both the share and the size ease across.
 *
 * :param distance: Metres from the camera to the nearest point of the grove.
 * :param height: The camera's height above the crowns, metres.
 * :param ground: The share the ground's thinning (leafFraction) draws for this grove.
 */
export function godLeafBlend(distance: number, height: number, ground: number): { fraction: number; scale: number } {
  const k = Math.min(1, Math.max(0, (height - GOD_BLEND_LOW) / (GOD_BLEND_HIGH - GOD_BLEND_LOW)));
  if (k === 0) return { fraction: ground, scale: 1 };
  const far = godLeafLod(distance);
  return { fraction: ground + (far.fraction - ground) * k, scale: 1 + (far.scale - 1) * k };
}
