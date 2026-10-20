/**
 * The lantern cart's cargo: where each pressed book rides in the bed.
 *
 * Pure layout, no React or three, so the tests can run it. Slot k belongs to
 * the k-th book pressed, and depends only on k and that book's slug, so
 * pressing one more book adds one book and never moves the others.
 *
 * The cart's local frame has forward as +z and the bed floor at y = 0.53. The
 * bed is 1.04 m wide between the side rails and runs from the tailboard to
 * the front board. The load is capped at LOAD_CAP, below the seat camera
 * (1.65 m) and the behind camera, and below the lamp (bottom about 1.13 m)
 * wherever the lamp is within reach of a book.
 */

/** One book in the cart, as a box placed in the cart's local frame. */
export type CartBook = {
  /** Center of the box in the cart's local frame, m. Forward is +z. */
  x: number;
  y: number;
  z: number;
  /** Box size: thickness (spine width), height, depth, m. */
  w: number;
  h: number;
  d: number;
  /** Yaw about y and a small lean about z, radians. The box turns by yaw after the lean. */
  yaw: number;
  lean: number;
  color: string;
};

/** The top of the bed floor, m: the planks' upper face. */
export const BED_FLOOR = 0.53;
/** No book rises above this, m. */
export const LOAD_CAP = 1.2;

/** Standing rows: books on their feet, spine to the tailboard, across the bed. */
const STANDING_COLS = 11;
const STANDING_ROWS = 7;
const STANDING_PITCH_X = 0.094;
const STANDING_PITCH_Z = 0.215;
/** Center of the first standing row, m: just clear of the tailboard. */
const STANDING_Z0 = -0.695;

/** Flat stacks: a regular grid of three columns, a few layers deep. */
const STACK_COLS = 3;
const STACK_ROWS = 8;
const STACK_LAYERS = 3;
const STACK_PITCH_X = 0.345;
/** The heap: four columns that overhang the side rails, laid on the stacks. */
const HEAP_COLS = 4;
const HEAP_LAYERS = 4;
const HEAP_PITCH_X = 0.315;
/** Row pitch and first row center for the flat grids, m. */
const FLAT_PITCH_Z = 0.1875;
const FLAT_Z0 = -0.80 + FLAT_PITCH_Z / 2;
/** Vertical pitch of the flat layers, m. */
const LAYER_PITCH = 0.045;
/** The flat layers rest on this height: above the tallest standing book (0.53 + 0.32) and the rails. */
const SHELF = 0.86;

const STANDING_COUNT = STANDING_COLS * STANDING_ROWS;
const STACK_COUNT = STACK_COLS * STACK_ROWS * STACK_LAYERS;
const HEAP_COUNT = HEAP_COLS * STACK_ROWS * HEAP_LAYERS;

/** How many books the cart holds; pressed books past this are not drawn. */
export const CART_CAPACITY = STANDING_COUNT + STACK_COUNT + HEAP_COUNT;

/** The color of a book whose slug the caller cannot place. */
export const NEUTRAL_SPINE = "#6b5a46";

/** A 32-bit FNV-1a hash of a string. */
function hashSlug(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A repeatable number in [0, 1) for one purpose of one book.
 *
 * :param hash: the book's slug hash.
 * :param salt: which quantity this is, so sizes and angles are independent.
 */
function unit(hash: number, salt: number): number {
  let h = (hash ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Linear blend from a to b by t in [0, 1). */
function between(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Half the size of the box's bounding box in the cart's frame, m. The box is
 * rotated about z by lean, then about y by yaw.
 *
 * :param b: the book, of which only the size and the two angles are read.
 */
export function cartBookHalfExtents(b: Pick<CartBook, "w" | "h" | "d" | "yaw" | "lean">): { x: number; y: number; z: number } {
  const cy = Math.abs(Math.cos(b.yaw));
  const sy = Math.abs(Math.sin(b.yaw));
  const cl = Math.abs(Math.cos(b.lean));
  const sl = Math.abs(Math.sin(b.lean));
  // Rows of R = Ry * Rz, absolute values, times the half sizes.
  const hw = b.w / 2;
  const hh = b.h / 2;
  const hd = b.d / 2;
  return {
    x: cy * cl * hw + cy * sl * hh + sy * hd,
    y: sl * hw + cl * hh,
    z: sy * cl * hw + sy * sl * hh + cy * hd,
  };
}

/** A box with its center placed so its lowest point rests on `base`. */
function restingOn(base: number, book: Omit<CartBook, "y">): CartBook {
  return { ...book, y: base + cartBookHalfExtents(book).y };
}

/** A book standing on the bed floor, spine to the tailboard, in standing slot k. */
function standing(k: number, hash: number, color: string): CartBook {
  const col = k % STANDING_COLS;
  const row = Math.floor(k / STANDING_COLS);
  return restingOn(BED_FLOOR, {
    x: (col - (STANDING_COLS - 1) / 2) * STANDING_PITCH_X + between(-0.003, 0.003, unit(hash, 5)),
    z: STANDING_Z0 + row * STANDING_PITCH_Z + between(-0.004, 0.004, unit(hash, 6)),
    w: between(0.05, 0.09, unit(hash, 0)),
    h: between(0.22, 0.32, unit(hash, 1)),
    d: between(0.17, 0.21, unit(hash, 2)),
    yaw: between(-0.03, 0.03, unit(hash, 3)),
    lean: between(-0.05, 0.05, unit(hash, 4)),
    color,
  });
}

/**
 * A book lying flat in a grid cell, its length across the bed. The box is
 * turned a quarter about z, so its height runs along x and its thickness up.
 *
 * :param cell: column, row and layer of the cell; columns count from the left.
 * :param cols: columns in this grid.
 * :param pitchX: column pitch, m.
 * :param yawMax: largest yaw off square, radians.
 * :param rollMax: largest roll off flat, radians; the book then leans on its neighbor.
 */
function lying(
  cell: { col: number; row: number; layer: number },
  cols: number,
  pitchX: number,
  yawMax: number,
  rollMax: number,
  hash: number,
  color: string,
): CartBook {
  return restingOn(SHELF + cell.layer * LAYER_PITCH, {
    x: (cell.col - (cols - 1) / 2) * pitchX + between(-0.006, 0.006, unit(hash, 5)),
    z: FLAT_Z0 + cell.row * FLAT_PITCH_Z + between(-0.004, 0.004, unit(hash, 6)),
    w: between(0.04, 0.045, unit(hash, 0)),
    h: between(0.22, 0.27, unit(hash, 1)),
    d: between(0.15, 0.165, unit(hash, 2)),
    yaw: between(-yawMax, yawMax, unit(hash, 3)),
    lean: Math.PI / 2 + between(-rollMax, rollMax, unit(hash, 4)),
    color,
  });
}

/**
 * Lay out the pressed books in the cart's bed, slot k for the k-th book pressed.
 *
 * The first books stand in rows across the bed from the tailboard forward,
 * the next lie in stacks on a shelf above them, and the rest are heaped on top,
 * wedged at angles and overhanging the side rails. Past CART_CAPACITY the
 * extra books are dropped.
 *
 * :param slugs: the pressed books in the order they were pressed.
 * :param colorOf: the spine color of a book, by slug.
 */
export function cartLoad(slugs: readonly string[], colorOf: (slug: string) => string): CartBook[] {
  const out: CartBook[] = [];
  const n = Math.min(slugs.length, CART_CAPACITY);
  for (let k = 0; k < n; k++) {
    const slug = slugs[k]!;
    const hash = hashSlug(slug);
    const color = colorOf(slug);
    if (k < STANDING_COUNT) {
      out.push(standing(k, hash, color));
    } else if (k < STANDING_COUNT + STACK_COUNT) {
      const i = k - STANDING_COUNT;
      const perLayer = STACK_COLS * STACK_ROWS;
      const layer = Math.floor(i / perLayer);
      const cell = { col: i % STACK_COLS, row: Math.floor((i % perLayer) / STACK_COLS), layer };
      out.push(lying(cell, STACK_COLS, STACK_PITCH_X, 0.06, 0, hash, color));
    } else {
      const i = k - STANDING_COUNT - STACK_COUNT;
      const perLayer = HEAP_COLS * STACK_ROWS;
      const layer = STACK_LAYERS + Math.floor(i / perLayer);
      const cell = { col: i % HEAP_COLS, row: Math.floor((i % perLayer) / HEAP_COLS), layer };
      out.push(lying(cell, HEAP_COLS, HEAP_PITCH_X, 0.12, 0.07, hash, color));
    }
  }
  return out;
}
