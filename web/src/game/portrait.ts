import type { TreeSite } from "./forest";

/**
 * Tree portraits: `?shot=<slug>` renders the forest with nothing on screen but
 * the tree, framed to fill the picture or at a scale shared with others
 * (commonFrame), for the book gallery
 * (web/scripts/gallery.mjs). Not a game feature.
 */

export type PortraitPose = { cam: [number, number, number]; look: [number, number, number]; fov: number };

/** A pose and the tree it is of, as an index into forest.trees. */
export type Portrait = PortraitPose & { tree: number };

/** How far a tree's wood reaches: its lowest and highest points, and its widest from the trunk, m. */
export type Extent = { minY: number; maxY: number; radius: number };

/** The vertical field of view of the portrait lens, degrees. */
export const PORTRAIT_FOV = 34;
/** The picture's width over its height. */
export const PORTRAIT_ASPECT = 1.6;
/** How much of the frame the tree may fill, leaving a margin. */
const FILL = 0.84;
/** Leaves reach past the wood that carries them, as a fraction of the wood's extent. */
const LEAF_REACH = 1.08;

/** The slug `?shot=` names, or null. */
export function shotSlug(search: string): string | null {
  return new URLSearchParams(search).get("shot")?.trim().toLowerCase() || null;
}

/**
 * The reach of a tree's wood, from its vertices in the grove's bark buffer.
 *
 * :param pos: The grove's bark positions, x y z per vertex.
 * :param start: The tree's first vertex.
 * :param count: How many vertices the tree has.
 */
export function treeExtent(pos: ArrayLike<number>, start: number, count: number, cx: number, cz: number): Extent {
  let minY = Infinity, maxY = -Infinity, radius = 0;
  for (let v = start; v < start + count; v++) {
    const y = pos[v * 3 + 1]!;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    radius = Math.max(radius, Math.hypot(pos[v * 3]! - cx, pos[v * 3 + 2]! - cz));
  }
  return { minY, maxY, radius };
}

/**
 * Where to stand to photograph a tree: far enough that all of it fits the
 * frame, looking at the middle of its height, from a fixed bearing.
 *
 * :param bearing: Which side to stand on, radians from +x.
 */
/** A shared framing for a set of portraits, so every tree is shown at the same scale. */
export type Frame = { dist: number; mid: number };

/** The framing that fits the largest of `extents`, for shooting them all at one scale. */
export function commonFrame(extents: Extent[]): Frame {
  const poses = extents.map((e) => portraitPose({ x: 0, z: 0 }, e));
  const i = poses.reduce((best, p, k) => (p.cam[2] > poses[best]!.cam[2] ? k : best), 0);
  return { dist: poses[i]!.cam[2], mid: poses[i]!.cam[1] };
}

export function portraitPose(tree: Pick<TreeSite, "x" | "z">, extent: Extent, bearing = Math.PI / 2, frame?: Frame): PortraitPose {
  const halfV = (PORTRAIT_FOV * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * PORTRAIT_ASPECT);
  const height = (extent.maxY - Math.min(0, extent.minY)) * LEAF_REACH;
  const width = extent.radius * 2 * LEAF_REACH;
  // The camera stands `dist` from the trunk, so the crown's near edge is closer than that.
  const dist = Math.max(height / (2 * Math.tan(halfV)), width / (2 * Math.tan(halfH))) / FILL + extent.radius;
  const mid = (Math.min(0, extent.minY) + extent.maxY) / 2;
  if (frame) {
    return {
      cam: [tree.x + Math.cos(bearing) * frame.dist, frame.mid, tree.z + Math.sin(bearing) * frame.dist],
      look: [tree.x, frame.mid, tree.z],
      fov: PORTRAIT_FOV,
    };
  }
  return {
    cam: [tree.x + Math.cos(bearing) * dist, mid, tree.z + Math.sin(bearing) * dist],
    look: [tree.x, mid, tree.z],
    fov: PORTRAIT_FOV,
  };
}
