/**
 * The compass rose inlaid in the hub plaza round the corpus redwood
 * (CompassRose.tsx): sixteen winds radiating from the trunk's root flare, a
 * degree bezel and the compass letters at the plaza's edge. The forest radiates
 * from the tree, so the rose does too. Drawn on a canvas whose top is north; the mesh that carries it is
 * laid flat so that top is the forest's north, -z (the forest's +x is east and
 * +z is south, sky.ts).
 */

import { MARK_INK } from "./genreMarks";

/** The rose's radius on the ground, m: the hub plaza is 10 m, and the spokes start 9 m out under it. */
export const ROSE_R = 9.6;
/** The mesh is laid flat by this rotation about x, which turns the canvas's up to -z. */
export const ROSE_TILT = -Math.PI / 2;

const GRID = 1024;
const C = GRID / 2;
/** Every radius below is in canvas units, 512 to the rose's rim. */

export type WindPoint = {
  name: string;
  /** Bearing clockwise from north, degrees. */
  bearing: number;
  /** Tip radius, canvas units. */
  tip: number;
  /** The point's shoulders: how far out they are as a fraction of its length, and how far round the rose they reach, degrees. */
  shoulder: number;
  spread: number;
};

/** The sixteen winds, longest first in the drawing order reversed so shorter points lie on top of the longer. */
export const WINDS: WindPoint[] = Array.from({ length: 16 }, (_, i) => {
  const bearing = i * 22.5;
  const rank = i % 4 === 0 ? 0 : i % 2 === 0 ? 1 : 2;
  const name = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][i]!;
  return { name, bearing, tip: [410, 386, 360][rank]! + (i === 0 ? 10 : 0), shoulder: [0.24, 0.22, 0.2][rank]!, spread: [45, 32, 22.5][rank]! };
});

const PAPER = "#efe6c8";
const TAN = "#b79f5f";
const RED = "#8a1f14";
const RED_LIGHT = "#c0432f";

/** The canvas point at a bearing and radius: north (bearing 0) is straight up. */
export function rosePoint(bearing: number, r: number): [number, number] {
  const a = (bearing * Math.PI) / 180;
  return [C + Math.sin(a) * r, C - Math.cos(a) * r];
}

/** One wind's point, from the hole's edge (the trunk) out to its tip. */
function wind(ctx: CanvasRenderingContext2D, w: WindPoint, holeR: number) {
  const tip = rosePoint(w.bearing, w.tip);
  const hub = rosePoint(w.bearing, holeR);
  const shoulderR = holeR + (w.tip - holeR) * w.shoulder;
  const left = rosePoint(w.bearing - w.spread, shoulderR);
  const right = rosePoint(w.bearing + w.spread, shoulderR);
  const north = w.bearing === 0;
  // Each point is two facets, one in shadow, as a card's points are.
  const half = (corner: [number, number], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(...tip);
    ctx.lineTo(...corner);
    ctx.lineTo(...hub);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  half(left, north ? RED : MARK_INK);
  half(right, north ? RED_LIGHT : TAN);
  ctx.beginPath();
  ctx.moveTo(...left);
  ctx.lineTo(...tip);
  ctx.lineTo(...hub);
  ctx.lineTo(...right);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = MARK_INK;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * Paints the rose into a square canvas context of any size; the top is north.
 *
 * :param hole: The trunk's share of the rose's radius, 0 to 1: the middle is
 *   left clear out to there, and the winds start from its edge.
 */
export function drawCompassRose(ctx: CanvasRenderingContext2D, size: number, hole = 0): void {
  const holeR = hole * 512;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / GRID, size / GRID);
  ctx.beginPath();
  ctx.arc(C, C, 508, 0, 2 * Math.PI);
  if (holeR > 0) ctx.arc(C, C, holeR, 0, 2 * Math.PI, true);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.strokeStyle = MARK_INK;
  ctx.fillStyle = MARK_INK;
  for (const [r, w] of [[506, 6], [478, 3], [428, 2]] as const) {
    ctx.beginPath();
    ctx.arc(C, C, r, 0, 2 * Math.PI);
    ctx.lineWidth = w;
    ctx.stroke();
  }
  // The degree bezel: a tick every 5 degrees, longer at 10 and again at each wind.
  for (let d = 0; d < 360; d += 5) {
    const len = d % 90 === 0 ? 28 : d % 45 === 0 ? 22 : d % 10 === 0 ? 15 : 9;
    ctx.lineWidth = d % 10 === 0 ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(...rosePoint(d, 478));
    ctx.lineTo(...rosePoint(d, 478 + len));
    ctx.stroke();
  }
  // Least points first, so the longer ones lie over their shoulders.
  for (const w of [...WINDS].sort((a, b) => a.tip - b.tip)) wind(ctx, w, holeR);
  // The hub: a ring and a dot where the winds meet, or a rule round the trunk.
  ctx.beginPath();
  ctx.arc(C, C, holeR > 0 ? holeR + 2 : 24, 0, 2 * Math.PI);
  ctx.fillStyle = PAPER;
  if (holeR === 0) ctx.fill();
  ctx.lineWidth = 4;
  ctx.stroke();
  if (holeR === 0) {
    ctx.beginPath();
    ctx.arc(C, C, 8, 0, 2 * Math.PI);
    ctx.fillStyle = RED;
    ctx.fill();
  }
  // Letters stand with their tops outward, as on a compass card.
  for (const w of WINDS) {
    if (w.bearing % 45 !== 0) continue;
    const cardinal = w.bearing % 90 === 0;
    ctx.save();
    ctx.translate(...rosePoint(w.bearing, 453));
    ctx.rotate((w.bearing * Math.PI) / 180);
    ctx.fillStyle = w.name === "N" ? RED : MARK_INK;
    ctx.font = `bold ${cardinal ? 58 : 30}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(w.name, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
