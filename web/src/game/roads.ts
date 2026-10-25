import type { RoadLine } from "./forest";

export type FlatMesh = { pos: number[]; uv: number[]; index: number[] };

// World metres per brick-texture repeat. UVs are planar (x, z) / tile, so the
// herringbone runs unbroken across every join, curve and plaza.
const BRICK_TILE = 2.4;

function vertex(out: FlatMesh, x: number, y: number, z: number) {
  out.pos.push(x, y, z);
  out.uv.push(x / BRICK_TILE, z / BRICK_TILE);
}

/**
 * A flat strip of `width` along a centreline at height `y`. Each point's edge
 * vertices sit on the bisector of its neighbouring segments, so consecutive
 * pieces share vertices instead of overlapping or leaving wedges.
 */
export function ribbon(line: RoadLine, width: number, y: number, out: FlatMesh) {
  const { pts, closed } = line;
  const n = pts.length;
  if (n < 2) return;
  const first = out.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    let tx = next[0] - prev[0], tz = next[1] - prev[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const [x, z] = pts[i]!;
    const h = width / 2;
    vertex(out, x - tz * h, y, z + tx * h);
    vertex(out, x + tz * h, y, z - tx * h);
  }
  const quads = closed ? n : n - 1;
  for (let i = 0; i < quads; i++) {
    const a = first + i * 2, b = a + 1;
    const c = first + ((i + 1) % n) * 2, d = c + 1;
    out.index.push(a, c, b, b, c, d);
  }
}

/** Road widths, m: the cart is 1.2 m wide and the tour keeps near the centreline. */
export const RING_W = 3.4;
export const SPOKE_W = 2.8;
export const SPUR_W = 2.4;
/** The curb radius where a spoke meets a ring, m. */
export const FILLET_R = 2;

/**
 * Where a spoke crosses a ring: the crossing point, the spoke's bearing `a`
 * and the ring's radius. `through` when the spoke runs on past the ring;
 * at the outer ring it ends there, a T.
 */
export type Junction = { x: number; z: number; a: number; ring: number; through: boolean };

/**
 * A point given in a junction's frame: `u` out from the ring's centreline
 * along the spoke, `v` along the ring from the spoke's centreline. Placed on
 * the ring's curve, so the ring's edges (u = +-RING_W / 2) are its circles
 * and the spoke's edges (v = +-SPOKE_W / 2) are straight to the centimetre.
 */
function junctionPoint(j: Junction, u: number, v: number): [number, number] {
  const r = j.ring + u;
  const t = j.a + v / r;
  return [r * Math.cos(t), r * Math.sin(t)];
}

/** The corners a junction's curbs round: four at a crossing, the two inside ones at a T. */
function corners(j: Junction): [number, number][] {
  const out: [number, number][] = [[-1, -1], [-1, 1]];
  if (j.through) out.push([1, -1], [1, 1]);
  return out;
}

/**
 * Pave the curbs of a junction: each corner between ring and spoke rounded
 * by a quarter circle of FILLET_R, so the tour cart's rounded turns stay on
 * the brick and the roads read as one road bending.
 */
export function fillets(j: Junction, y: number, out: FlatMesh, steps = 8) {
  const hr = RING_W / 2, hs = SPOKE_W / 2, f = FILLET_R;
  for (const [su, sv] of corners(j)) {
    // Fan from the corner over the arc, centred (hr + f, hs + f) out in this quadrant.
    const pts: [number, number][] = [junctionPoint(j, su * hr, sv * hs)];
    for (let k = 0; k <= steps; k++) {
      const q = (Math.PI / 2) * (k / steps);
      pts.push(junctionPoint(j, su * (hr + f - f * Math.cos(q)), sv * (hs + f - f * Math.sin(q))));
    }
    const first = out.pos.length / 3;
    for (const [x, z] of pts) vertex(out, x, y, z);
    for (let k = 1; k < pts.length - 1; k++) {
      const [x0, z0] = pts[0]!, [x1, z1] = pts[k]!, [x2, z2] = pts[k + 1]!;
      // Wind each triangle face up, as disc() does.
      const up = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0) > 0;
      out.index.push(first, first + (up ? k : k + 1), first + (up ? k + 1 : k));
    }
  }
}

/** Whether (x, z) is on one of a junction's curb fillets. */
export function onFillet(x: number, z: number, j: Junction): boolean {
  const hr = RING_W / 2, hs = SPOKE_W / 2, f = FILLET_R;
  const r = Math.hypot(x, z);
  const u = r - j.ring;
  const v = Math.atan2(Math.sin(Math.atan2(z, x) - j.a), Math.cos(Math.atan2(z, x) - j.a)) * r;
  if (!j.through && u > 0) return false;
  const au = Math.abs(u), av = Math.abs(v);
  if (au < hr || av < hs || au > hr + f || av > hs + f) return false;
  return Math.hypot(au - (hr + f), av - (hs + f)) >= f;
}

/** A paved disc: the hub, a stop, an exhibit's plaza. */
export function disc(x: number, z: number, r: number, y: number, out: FlatMesh, segments = 28) {
  const centre = out.pos.length / 3;
  vertex(out, x, y, z);
  for (let s = 0; s <= segments; s++) {
    const a = (2 * Math.PI * s) / segments;
    vertex(out, x + Math.cos(a) * r, y, z + Math.sin(a) * r);
  }
  for (let s = 0; s < segments; s++) out.index.push(centre, centre + 2 + s, centre + 1 + s);
}
