import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { cartLoad, cartBookHalfExtents, BED_FLOOR, CART_CAPACITY, LOAD_CAP } = require(`${process.env.FOREST_TEST_BUILD}/cartLoad.js`);

const CORPUS = 253;
const slugs = Array.from({ length: CORPUS }, (_, k) => `book-${k}-${(k * 7919) % 1013}`);
const colorOf = (slug) => `#${(slug.length * 1234567 % 0xffffff).toString(16).padStart(6, "0")}`;

/** The box's rotated bounding box in the cart's frame. */
function bounds(b) {
  const e = cartBookHalfExtents(b);
  return { x0: b.x - e.x, x1: b.x + e.x, y0: b.y - e.y, y1: b.y + e.y, z0: b.z - e.z, z1: b.z + e.z };
}

/** Does the box's bounding box cut the region? */
function cuts(b, r) {
  const a = bounds(b);
  return a.x1 > r.x0 && a.x0 < r.x1 && a.y1 > r.y0 && a.y0 < r.y1 && a.z1 > r.z0 && a.z0 < r.z1;
}

test("an empty press carries nothing, and n books give n boxes", () => {
  assert.deepEqual(cartLoad([], colorOf), []);
  for (const n of [1, 2, 11, 12, 77, 78, 100, 149, 150, 200, 252, CORPUS]) {
    assert.equal(cartLoad(slugs.slice(0, n), colorOf).length, n);
  }
});

test("the cart holds the whole corpus, and drops books past its capacity", () => {
  assert.ok(CART_CAPACITY >= CORPUS);
  const many = Array.from({ length: CART_CAPACITY + 20 }, (_, k) => `extra-${k}`);
  assert.equal(cartLoad(many, colorOf).length, CART_CAPACITY);
});

test("each box carries its book's color", () => {
  const load = cartLoad(slugs.slice(0, 40), colorOf);
  load.forEach((b, k) => assert.equal(b.color, colorOf(slugs[k])));
});

test("pressing one more book adds one book and moves none", () => {
  const full = cartLoad(slugs, colorOf);
  for (let k = 0; k < CORPUS; k++) {
    assert.deepEqual(cartLoad(slugs.slice(0, k + 1), colorOf).slice(0, k), full.slice(0, k), `after ${k + 1} books`);
  }
});

test("the same press gives the same load", () => {
  assert.deepEqual(cartLoad(slugs, colorOf), cartLoad([...slugs], colorOf));
});

test("every box sits inside the bed, above its floor and under the cap", () => {
  const load = cartLoad(slugs, colorOf);
  load.forEach((b, k) => {
    const a = bounds(b);
    // The side rails stand at 0.55 m. The standing books and stacks stay between
    // them; the heap overhangs them by up to 0.1 m, from the 150th book on.
    const heap = k >= 77 + 72;
    const side = heap ? 0.65 : 0.55;
    assert.ok(-a.x0 <= side && a.x1 <= side, `book ${k} x ${a.x0.toFixed(3)}..${a.x1.toFixed(3)}`);
    // The tailboard and front board stand at -0.9 and 0.9, 0.05 m thick.
    assert.ok(a.z0 >= -0.875 && a.z1 <= 0.875, `book ${k} z ${a.z0.toFixed(3)}..${a.z1.toFixed(3)}`);
    assert.ok(a.y0 >= BED_FLOOR - 1e-9, `book ${k} bottom ${a.y0.toFixed(3)}`);
    assert.ok(a.y1 <= LOAD_CAP, `book ${k} top ${a.y1.toFixed(3)}`);
  });
  assert.equal(LOAD_CAP, 1.2);
});

test("the heap that overhangs the rails stays above the rails and the wheels", () => {
  // The rails' top is at 0.855 m and the rear wheels' tires reach 0.84 m.
  const load = cartLoad(slugs, colorOf);
  for (const b of load) {
    const a = bounds(b);
    if (a.x1 > 0.55 || -a.x0 > 0.55) assert.ok(a.y0 >= 0.855, `overhanging book bottom ${a.y0.toFixed(3)}`);
  }
});

test("the view from the seat and from behind is clear: nothing stands in 1.3 to 1.65 m", () => {
  // The seat camera is 0.45 m behind the cart's center at 1.65 m, looking level
  // forward. The cap at 1.2 m keeps the whole slab from the seat to the front
  // board empty; this states why.
  const slab = { x0: -1, x1: 1, y0: 1.3, y1: 1.65, z0: -0.45, z1: 0.9 };
  for (const b of cartLoad(slugs, colorOf)) assert.ok(!cuts(b, slab));
});

test("the lantern's hook and lamp are clear of the load", () => {
  // The hook stands at x -0.46, z 0.84; the lamp hangs at x -0.2, z 0.84, from
  // 1.13 m up, with a 0.1 m radius.
  const hook = { x0: -0.5, x1: -0.42, y0: 0.48, y1: 1.5, z0: 0.8, z1: 0.88 };
  const lamp = { x0: -0.32, x1: -0.08, y0: 1.13, y1: 1.4, z0: 0.72, z1: 0.96 };
  for (const b of cartLoad(slugs, colorOf)) {
    assert.ok(!cuts(b, hook));
    assert.ok(!cuts(b, lamp));
  }
});

test("no two boxes overlap much", () => {
  // Bounding boxes of turned books overlap a little where the books do not,
  // so a depth of 3 cm on every axis at once is the most that is allowed.
  const tol = 0.03;
  const boxes = cartLoad(slugs, colorOf).map(bounds);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      assert.ok(!(ox > tol && oy > tol && oz > tol), `books ${i} and ${j} overlap by ${ox.toFixed(3)}, ${oy.toFixed(3)}, ${oz.toFixed(3)}`);
    }
  }
});
