import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Object3D } from "three";
import type { Forest } from "./forest";
import { mulberry32 } from "./math";
import type { SeasonName } from "./seasons";

/**
 * The forest floor's litter, as data: where each grass tuft and rock stands, and
 * its colour. Pure, so the game (Environment.tsx ForestFloor) and the Blender
 * export (scripts/forest3d/export.mjs) place exactly the same tufts and stones.
 */

/** One kind of litter: `count` instances, a 4x4 matrix (column-major, as three's) and a linear RGB colour each. */
export type LitterSet = { count: number; matrix: Float32Array; color: Float32Array };

/** A lumpy, faceted rock: an icosahedron whose vertices are pushed in and out by a hash of their direction. */
export function rockGeometry(seed: number) {
  const g = new IcosahedronGeometry(1, 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Same direction, same push: shared corners of adjacent faces stay welded.
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    const k = 0.78 + 0.36 * (h - Math.floor(h));
    p.setXYZ(i, x * k, y * k * 0.72, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A grass tuft: nine slender blades fanning out from one root, each a curved
 * three-segment strip that tapers to a point and bends outward as it rises.
 * Vertex colour runs dark at the base to light at the tip, so a tuft reads as
 * grass rather than as a solid shape.
 */
export function tuftGeometry() {
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const rng = mulberry32(911);
  const blades = 9;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + rng() * 0.5;
    const ox = Math.cos(a), oz = Math.sin(a);
    // Perpendicular for blade width.
    const px = -oz, pz = ox;
    const h = 0.6 + rng() * 0.4;
    const bend = 0.25 + rng() * 0.35;
    const w = 0.03 + rng() * 0.015;
    const first = pos.length / 3;
    const segs = 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const out = bend * t * t + 0.04; // curves outward more near the tip
      const cx = ox * out, cz = oz * out, cy = h * t;
      const half = w * (1 - t) + 0.002;
      pos.push(cx - px * half, cy, cz - pz * half, cx + px * half, cy, cz + pz * half);
      const shade = 0.45 + 0.65 * t;
      col.push(shade, shade, shade, shade, shade, shade);
    }
    for (let s = 0; s < segs; s++) {
      const i = first + s * 2;
      index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Up to 24 pieces of litter round every trunk, a quarter of them stones and the
 * rest grass, kept off the roads and plazas. Seeded, so every run places the same.
 *
 * :param forest: The forest.
 * :param season: Tints the grass and the stones.
 * :return: The grass tufts and the rocks.
 */
export function floorLitter(forest: Pick<Forest, "trees" | "plazas" | "roads">, season: SeasonName): { grass: LitterSet; rocks: LitterSet } {
  const max = forest.trees.length * 24;
  const grass: LitterSet = { count: 0, matrix: new Float32Array(max * 16), color: new Float32Array(max * 3) };
  const rocks: LitterSet = { count: 0, matrix: new Float32Array(max * 16), color: new Float32Array(max * 3) };
  const random = mulberry32(247);
  const dummy = new Object3D();
  const color = new Color();
  const put = (set: LitterSet) => {
    dummy.updateMatrix();
    dummy.matrix.toArray(set.matrix, set.count * 16);
    color.toArray(set.color, set.count * 3);
    set.count++;
  };
  const placeRock = (x: number, z: number, size: number) => {
    dummy.position.set(x, size * 0.18, z); // half-sunk
    dummy.rotation.set(random() * 0.6, random() * Math.PI * 2, random() * 0.6);
    dummy.scale.set(size * (0.8 + random() * 0.5), size * (0.6 + random() * 0.5), size * (0.8 + random() * 0.5));
    color.set(season === "winter" ? "#eef2f2" : "#d9d8cf").offsetHSL(0, 0, (random() - 0.5) * 0.14);
    put(rocks);
  };
  for (const tree of forest.trees) {
    for (let i = 0; i < 24; i++) {
      const angle = random() * Math.PI * 2;
      const radius = tree.trunkRadius + 1.3 + random() * 6;
      const x = tree.x + Math.cos(angle) * radius;
      const z = tree.z + Math.sin(angle) * radius;
      // Leave the carriage paths and plazas clear.
      if (forest.plazas.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
      if (forest.roads.some((r) => {
        const dx = r.bx - r.ax, dz = r.bz - r.az;
        const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) < 2;
      })) continue;
      // A quarter of the floor litter is stone, the rest grass.
      if (random() < 0.25) {
        placeRock(x, z, 0.18 + random() * 0.32);
        continue;
      }
      const height = 0.3 + random() * 0.4;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      const spread = 0.7 + random() * 0.5;
      dummy.scale.set(spread, height, spread);
      color.set(season === "winter" ? "#c1bca1" : season === "autumn" ? "#9a793e" : "#637747");
      color.offsetHSL(0, 0, (random() - 0.5) * 0.16);
      put(grass);
    }
  }
  return { grass, rocks };
}
