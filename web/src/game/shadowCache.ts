/**
 * The sun's shadow map, redrawn only when it is stale and centred on whole
 * texels. Solstice (github.com/SamG-Coder/solstice, MIT) redraws a shadow
 * cascade only when its view changes, its largest single saving on small GPUs.
 */

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
