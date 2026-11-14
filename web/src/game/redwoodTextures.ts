/**
 * The corpus redwood's textures as data: its bark (color and normal pixels) and
 * the strokes of its needle spray. Pure, so the game (CorpusRedwood.tsx, which
 * puts them on canvases) and the Blender export (scripts/forest3d/export.mjs)
 * draw the same redwood.
 */

/** Seamless value noise on a gx by gy lattice, smoothly interpolated; u and v in [0, 1). */
export function tiledNoise(u: number, v: number, gx: number, gy: number, seed: number): number {
  const hash = (i: number, j: number) => {
    let h = (((i % gx) + gx) % gx) * 374761393 + (((j % gy) + gy) % gy) * 668265263 + seed * 2147483647;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const x = u * gx, y = v * gy;
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** RGBA rows, top row first, as a canvas's ImageData holds them. */
export type Pixels = { width: number; height: number; color: Uint8ClampedArray; normal: Uint8ClampedArray };

/**
 * Redwood bark: long fibrous ridges between deep furrows that wander as they
 * climb, cinnamon on the ridges and near-black in the cracks. A height field
 * gives both the color and the normal map, and every term is periodic, so the
 * tile repeats without a seam (corpusTree.ts REDWOOD_BARK sets its size).
 */
export function redwoodBarkPixels(): Pixels {
  const W = 256, H = 512, RIDGES = 8;
  const height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // Furrows meander: whole-number frequencies in both directions keep the tile seamless.
      const wander = 0.22 * Math.sin(2 * Math.PI * (2 * v + u)) + 0.14 * Math.sin(2 * Math.PI * (3 * v - 2 * u) + 1.3)
        + 0.5 * (tiledNoise(u, v, 8, 3, 1) - 0.5);
      const t = (((u * RIDGES + wander) % 1) + 1) % 1;
      const ridge = Math.pow(Math.sin(Math.PI * t), 0.55);
      // Fibres: noise stretched up the trunk, fine across it.
      const fibre = tiledNoise(u, v, 96, 10, 2) * 0.6 + tiledNoise(u, v, 48, 5, 3) * 0.4;
      height[y * W + x] = ridge * (0.72 + 0.28 * fibre) - 0.12 * tiledNoise(u, v, 16, 4, 4);
    }
  }
  const color = new Uint8ClampedArray(W * H * 4), normal = new Uint8ClampedArray(W * H * 4);
  const at = (x: number, y: number) => height[((y + H) % H) * W + ((x + W) % W)]!;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = Math.max(0, at(x, y));
      const k = (y * W + x) * 4;
      const tone = Math.pow(h, 1.3);
      // Furrow (38, 17, 11) to cinnamon ridge (156, 74, 44), greying a little on the most weathered tops.
      const grey = Math.max(0, h - 0.82) * 1.6;
      color[k] = 38 + (156 - 38) * tone + (150 - 156) * grey;
      color[k + 1] = 17 + (74 - 17) * tone + (118 - 74) * grey;
      color[k + 2] = 11 + (44 - 11) * tone + (100 - 44) * grey;
      color[k + 3] = 255;
      // Tangent-space normal, +v up the image (textures load flipped).
      const dx = (at(x + 1, y) - at(x - 1, y)) * 3.2, dy = (at(x, y + 1) - at(x, y - 1)) * 3.2;
      const len = Math.hypot(dx, dy, 1);
      normal[k] = ((-dx / len) * 0.5 + 0.5) * 255;
      normal[k + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      normal[k + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normal[k + 3] = 255;
    }
  }
  return { width: W, height: H, color, normal };
}

/** One round-capped line of the spray, in canvas pixels; `rgb` is `style` as sRGB 0-255. */
export type Stroke = { x0: number; y0: number; x1: number; y1: number; width: number; style: string; rgb: [number, number, number] };

/** CSS hsl() as sRGB 0-255, as a canvas resolves it. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** The spray's canvas: its stem runs along y = 64 from the base (left) to the tip. */
export const SPRAY_SIZE = { width: 256, height: 128 };

/**
 * One flat redwood spray: a stem from the base (left) to the tip, short flat
 * needles either side, longest mid-spray. Near-white so each instance's color
 * tints it; the transparent ground is cut away by alphaTest.
 */
export function sprayStrokes(): Stroke[] {
  const strokes: Stroke[] = [{ x0: 4, y0: 64, x1: 250, y1: 64, width: 4, style: "#c9d3ad", rgb: [0xc9, 0xd3, 0xad] }];
  for (let x = 10; x < 248; x += 6) {
    const t = (x - 10) / 238;
    const len = 54 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) + 6;
    for (const side of [-1, 1]) {
      const l = 78 + ((x * 7 + side * 13) % 17);
      strokes.push({ x0: x, y0: 64, x1: x + len * 0.3, y1: 64 + side * len, width: 5, style: `hsl(95 30% ${l}%)`, rgb: hslToRgb(95, 30, l) });
    }
  }
  return strokes;
}
