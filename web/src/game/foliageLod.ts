/**
 * Two savings borrowed from Solstice (github.com/SamG-Coder/solstice, MIT):
 * foliage that thins with distance, as Nanite's foliage does, and a shadow
 * map redrawn only when what it shows has changed.
 */

/** Within this many metres of the camera a grove draws every leaf. */
export const LEAF_FULL_DISTANCE = 45;
/** The most a far leaf is enlarged; so a grove never drops below 1 / LEAF_MAX_SCALE² of its leaves. */
export const LEAF_MAX_SCALE = 3;

/**
 * The share of a grove's leaves to draw at this distance, and how much to
 * enlarge each so the crown covers as much of the screen. A leaf's area on
 * screen falls as 1 / distance², so drawing that share of them, each scaled
 * by 1 / sqrt(share), keeps the leaf area the eye sees constant.
 *
 * :param distance: Metres from the camera to the nearest point of the grove.
 * :returns: `fraction` in (0, 1] and `scale` >= 1, with fraction * scale² = 1.
 */
export function leafLod(distance: number): { fraction: number; scale: number } {
  if (!(distance > LEAF_FULL_DISTANCE)) return { fraction: 1, scale: 1 };
  const fraction = Math.max((LEAF_FULL_DISTANCE / distance) ** 2, 1 / LEAF_MAX_SCALE ** 2);
  return { fraction, scale: 1 / Math.sqrt(fraction) };
}

/**
 * An instance order for one grove: its shown leaves first, shuffled, then the
 * hidden ones. Any prefix of the shown part is then a fair sample of the
 * whole crown, so drawing the first `fraction` of them thins every tree
 * evenly instead of dropping whole trees.
 *
 * :param shown: For each leaf of the grove, whether it is drawn at all.
 * :param seed: Fixes the shuffle, so the same grove thins the same way each time.
 * :returns: `order[slot]` is the leaf (0-based in the grove) for that instance slot; `shown` is how many lead.
 */
export function leafOrder(shown: ArrayLike<boolean>, seed: number): { order: Int32Array; shown: number } {
  const n = shown.length;
  const order = new Int32Array(n);
  let front = 0;
  let back = n - 1;
  for (let i = 0; i < n; i++) {
    if (shown[i]) order[front++] = i;
    else order[back--] = i;
  }
  // Fisher-Yates over the shown leaves, from a small seeded generator (mulberry32).
  let s = seed >>> 0;
  const random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = front - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  return { order, shown: front };
}

/** Moving this far, metres, or turning the light this much (1 - cos), makes the shadow map stale. */
const SHADOW_MOVED = 0.01;
const SHADOW_TURNED = 1e-6;
/** While the cart moves, redraw the shadow map every this many frames. */
export const SHADOW_MOVING_FRAMES = 2;
/** At rest with the wind blowing, every this many frames, so the leaves' sway still shows in their shadows. */
export const SHADOW_IDLE_FRAMES = 4;
/** And never less often than this, so a change nothing here tracks (a new season, a regrown forest) shows within a second or so. */
export const SHADOW_MAX_FRAMES = 30;

export type ShadowState = { x: number; z: number; dir: [number, number, number]; frames: number };

/**
 * Whether the sun's shadow map needs redrawing this frame. Solstice redraws a
 * shadow cascade only when its view changes, its largest single saving on
 * small GPUs; here the map follows the cart, so it is redrawn while the cart
 * moves (every other frame), every few frames at rest while the wind moves
 * the leaves, at once when the sun moves, and otherwise about twice a second.
 *
 * :param last: The state at the last redraw, with `frames` counting frames since; null before the first.
 * :param x: The cart's position now.
 * :param z: The cart's position now.
 * :param dir: The light's direction now, unit length.
 * :param animating: Whether anything casting a shadow is moving on its own (the wind).
 */
export function shadowStale(last: ShadowState | null, x: number, z: number, dir: [number, number, number], animating: boolean): boolean {
  if (!last) return true;
  const turned = 1 - (last.dir[0] * dir[0] + last.dir[1] * dir[1] + last.dir[2] * dir[2]);
  if (turned > SHADOW_TURNED) return true;
  const frames = last.frames + 1;
  if (frames >= SHADOW_MAX_FRAMES) return true;
  if (Math.hypot(x - last.x, z - last.z) > SHADOW_MOVED) return frames >= SHADOW_MOVING_FRAMES;
  return animating && frames >= SHADOW_IDLE_FRAMES;
}

/**
 * Snaps the point the shadow camera centres on to whole shadow-map texels, in
 * the light's view, so that shadow edges keep still as the cart drives rather
 * than crawling as the map slides under them.
 *
 * :param x: The point to centre on, on the ground.
 * :param z: The point to centre on, on the ground.
 * :param dir: The light's direction, unit length, from the ground towards the light.
 * :param texel: One shadow-map texel, metres (the camera's width / the map's size).
 * :returns: The snapped point; it may sit just off the ground, which the light does not mind.
 */
export function snapToTexels(x: number, z: number, dir: [number, number, number], texel: number): [number, number, number] {
  const [dx, dy, dz] = dir;
  // The light's right and up axes: right is horizontal, up is perpendicular to both.
  let rx = dz, rz = -dx;
  const rl = Math.hypot(rx, rz);
  if (rl < 1e-6) {
    rx = 1;
    rz = 0;
  } else {
    rx /= rl;
    rz /= rl;
  }
  const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx;
  const a = x * rx + z * rz;
  const b = x * ux + z * uz;
  const sa = Math.round(a / texel) * texel - a;
  const sb = Math.round(b / texel) * texel - b;
  return [x + sa * rx + sb * ux, sb * uy, z + sa * rz + sb * uz];
}
