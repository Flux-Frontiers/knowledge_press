/**
 * The genre marks: one round mark per grove, the press seal's construction
 * (assets/brand-system/README.md) with the grove's color in the band and a
 * glyph for the genre in the ink disc. Painted on the stop plaza ahead of
 * each grove (GroveMarks.tsx) and drawn beside each genre in the book list
 * and the atlas (GenreGlyph.tsx), so the mark and the list agree.
 *
 * Glyphs are SVG path data on a 100-unit grid, one line weight, round ends,
 * kept inside radius 40 of the centre so they clear the seal's rule.
 */

export const MARK_INK = "#151b29";
export const MARK_PAPER = "#f4f0dc";

/** One path of a glyph: stroked in paper, and filled when `fill` says so. */
export type Stroke = { d: string; fill?: "paper" | "ink" };

export type Glyph = {
  strokes: Stroke[];
  /** Line weight on the 100 grid; the filled glyphs use a thinner outline. */
  width: number;
  /** What the glyph is, for the page and the alt text. */
  name: string;
};

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

const line = (strokes: (string | Stroke)[], name: string, width = 5): Glyph => ({
  name, width, strokes: strokes.map((s) => (typeof s === "string" ? { d: s } : s)),
});

export const GLYPHS: Record<string, Glyph> = {
  "american-literature": line([
    "M10 68 L16 82 H84 L92 68 Z", "M22 68 V56 H78 V68", "M30 56 V44 H70 V56", "M44 44 V34 H56 V44",
    "M36 44 V16", "M62 44 V16", "M32 16 H40", "M58 16 H66",
    circle(16, 66, 11), "M16 55 V77 M5 66 H27 M8 58 L24 74 M24 58 L8 74",
    "M8 90 C14 86 20 86 26 90 S38 94 44 90 S56 86 62 90 S74 94 80 90 S90 86 94 90",
  ], "a sternwheeler, for Twain"),
  "ancient-classical": line([
    "M38 16 H62",
    "M42 16 V26 C26 34 24 56 36 72 C40 78 44 82 44 88 H56 C56 82 60 78 64 72 C76 56 74 34 58 26 V16",
    "M40 30 C28 30 24 44 32 48", "M60 30 C72 30 76 44 68 48", "M36 60 H64",
  ], "an amphora"),
  "audel-electric": line([{ d: "M58 8 L28 54 H48 L40 92 L72 42 H52 Z", fill: "paper" }], "a lightning bolt", 3),
  biography: line([
    ellipse(50, 50, 30, 38),
    { d: "M50 30 C42 30 38 36 38 44 C38 50 42 56 50 56 C56 56 60 50 60 44 C60 36 56 30 50 30 Z", fill: "paper" },
    { d: "M32 78 C34 66 42 60 50 60 C58 60 66 66 68 78 Z", fill: "paper" },
  ], "a cameo"),
  diaries: line([
    circle(30, 50, 13), { d: circle(30, 50, 4), fill: "paper" }, "M43 50 H82", "M72 50 V62", "M62 50 V58", "M82 50 V60",
  ], "the key to a locked diary"),
  drama: line([
    "M14 36 C14 22 50 22 50 36 C50 54 42 66 32 66 C22 66 14 54 14 36 Z",
    "M24 40 L30 38", "M40 40 L34 38", "M24 50 C28 56 36 56 40 50",
    { d: "M50 44 C50 30 86 30 86 44 C86 62 78 74 68 74 C58 74 50 62 50 44 Z", fill: "ink" },
    "M60 48 L66 50", "M76 48 L70 50", "M60 64 C64 58 72 58 76 64",
  ], "comedy and tragedy"),
  "english-literature": line([
    "M76 14 C50 22 34 44 26 76",
    { d: "M76 14 C60 16 44 30 40 48 C52 44 66 30 76 14 Z", fill: "paper" },
    "M40 48 C36 52 32 58 30 64", "M26 76 L22 86", "M18 88 L44 88",
  ], "a quill"),
  "french-literature": line([
    { d: "M50 8 C41 22 41 40 47 58 L53 58 C59 40 59 22 50 8 Z", fill: "paper" },
    { d: "M45 58 C30 58 18 48 18 34 C18 46 30 52 44 52 Z", fill: "paper" },
    { d: "M55 58 C70 58 82 48 82 34 C82 46 70 52 56 52 Z", fill: "paper" },
    { d: "M40 62 H60 V70 H40 Z", fill: "paper" },
    { d: "M45 72 C45 82 40 88 34 92 L66 92 C60 88 55 82 55 72 Z", fill: "paper" },
  ], "the fleur-de-lis", 3),
  "german-literature": line([
    "M16 84 V30 H22 V38 H30 V30 H36 V84", "M64 84 V30 H70 V38 H78 V30 H84 V84", "M36 84 V48 H64 V84",
    "M36 48 H40 V42 H46 V48 H54 V42 H60 V48 H64", "M44 84 V70 C44 64 56 64 56 70 V84", "M12 84 H88",
  ], "a castle gate"),
  horror: line([
    { d: "M50 42 C42 32 26 32 10 44 C22 42 28 48 30 56 C36 52 42 54 45 62 C47 59 53 59 55 62 C58 54 64 52 70 56 C72 48 78 42 90 44 C74 32 58 32 50 42 Z", fill: "paper" },
    { d: "M44 40 L46 30 L50 38 L54 30 L56 40 Z", fill: "paper" },
  ], "a bat", 3),
  letters: line([
    "M19 28 H81 a3 3 0 0 1 3 3 V71 a3 3 0 0 1 -3 3 H19 a3 3 0 0 1 -3 -3 V31 a3 3 0 0 1 3 -3 Z",
    "M16 30 L50 56 L84 30", { d: circle(50, 58, 7), fill: "paper" },
  ], "a sealed letter"),
  "natural-history": line([
    "M50 50 C54 46 58 48 58 53 C58 59 51 63 45 61 C37 58 34 49 38 41 C43 31 57 28 66 35 C77 43 78 59 70 69 C60 81 40 82 28 72 C15 61 14 40 26 27",
    "M45 61 L41 68", "M38 41 L31 38", "M66 35 L70 28", "M70 69 L78 72",
  ], "an ammonite"),
  philosophy: line([
    "M22 34 L30 18 L40 30", "M78 34 L70 18 L60 30", circle(50, 50, 31), circle(38, 47, 9), circle(62, 47, 9),
    { d: circle(38, 47, 3), fill: "paper" }, { d: circle(62, 47, 3), fill: "paper" },
    { d: "M46 58 L50 66 L54 58 Z", fill: "paper" },
  ], "the owl of Athena"),
  "russian-literature": line([
    "M30 60 C22 40 44 36 50 16 C56 36 78 40 70 60 Z", "M30 60 V70 H70 V60", "M26 76 H74", "M50 16 V8",
    "M50 22 C46 34 46 48 50 60", "M50 22 C54 34 54 48 50 60",
  ], "an onion dome"),
  "sacred-texts": line([
    "M50 50 C40 44 26 44 14 48 V82 C26 78 40 78 50 84 C60 78 74 78 86 82 V48 C74 44 60 44 50 50 Z",
    "M50 50 V84", "M50 12 V24", "M32 18 L38 28", "M68 18 L62 28", "M18 32 L28 38", "M82 32 L72 38",
  ], "an open book under rays"),
  "science-fiction": line([
    circle(50, 50, 19),
    // The ring: an ellipse rx 38, ry 10 turned 18 degrees, from its left end.
    "M13.86 61.74 a38 10 -18 1 0 72.28 -23.48 a38 10 -18 1 0 -72.28 23.48",
  ], "a ringed planet"),
  shakespeare: line([
    "M26 46 C26 28 74 28 74 46 C74 56 68 60 66 64 V74 H34 V64 C32 60 26 56 26 46 Z",
    { d: circle(40, 48, 6), fill: "paper" }, { d: circle(60, 48, 6), fill: "paper" },
    { d: "M50 56 L46 63 H54 Z", fill: "paper" }, "M42 74 V82 M50 74 V84 M58 74 V82",
  ], "Yorick"),
  spanish: line([
    "M40 90 L44 50 H56 L60 90 Z", "M42 50 L50 40 L58 50",
    "M50 44 L22 20", "M50 44 L78 20", "M50 44 L22 68", "M50 44 L78 68",
    "M22 20 L32 14 L36 24 Z", "M78 20 L68 14 L64 24 Z", "M22 68 L32 74 L36 64 Z", "M78 68 L68 74 L64 64 Z",
  ], "a windmill, for Quixote"),
  travel: line([
    circle(50, 50, 34), { d: "M50 14 L56 44 L50 50 Z", fill: "paper" }, "M50 14 L44 44 L50 50 Z",
    "M50 86 L44 56 L50 50 L56 56 Z", "M14 50 L44 44 L50 50 L44 56 Z", "M86 50 L56 44 L50 50 L56 56 Z",
  ], "a compass rose"),
  "world-literature": line([
    circle(50, 50, 32), ellipse(50, 50, 14, 32), "M18 50 H82", "M24 34 H76", "M24 66 H76",
  ], "a globe"),
};

/** The genre's glyph; an unmapped genre gets the globe. */
export function glyphFor(genre: string): Glyph {
  return GLYPHS[genre] ?? GLYPHS["world-literature"]!;
}

// The seal's construction on its 1024 grid (assets/brand-system/README.md).
const GRID = 1024;
export const MARK_BAND_R = 347;
const RULE_R = 313, RULE_W = 17, DISC_R = 273;
/** The glyph's 100 grid fills 400 units of the seal's, centred. */
const GLYPH_SCALE = 4;

/**
 * Paint a genre mark filling a square canvas context of `size` pixels.
 *
 * :param band: The grove's color, for the outer band.
 */
export function drawGenreMark(ctx: CanvasRenderingContext2D, size: number, band: string, genre: string): void {
  const glyph = glyphFor(genre);
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / GRID, size / GRID);
  const c = GRID / 2;
  ctx.beginPath();
  ctx.arc(c, c, MARK_BAND_R, 0, 2 * Math.PI);
  ctx.fillStyle = band;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, RULE_R, 0, 2 * Math.PI);
  ctx.lineWidth = RULE_W;
  ctx.strokeStyle = MARK_PAPER;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, DISC_R, 0, 2 * Math.PI);
  ctx.fillStyle = MARK_INK;
  ctx.fill();

  ctx.translate(c - 50 * GLYPH_SCALE, c - 50 * GLYPH_SCALE);
  ctx.scale(GLYPH_SCALE, GLYPH_SCALE);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = glyph.width;
  ctx.strokeStyle = MARK_PAPER;
  for (const s of glyph.strokes) {
    const path = new Path2D(s.d);
    if (s.fill) {
      ctx.fillStyle = s.fill === "ink" ? MARK_INK : MARK_PAPER;
      ctx.fill(path);
    }
    ctx.stroke(path);
  }
  ctx.restore();
}
