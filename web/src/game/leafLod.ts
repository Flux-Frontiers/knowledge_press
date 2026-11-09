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
