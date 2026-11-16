/**
 * A chapter's text as blocks the reader shows and read-aloud speaks.
 *
 * The book files keep the printed edition's hard line wrap and its plain-text
 * markup (`_italic_`, `[1]` footnote marks, `[Illustration: ...]`). `reflow`
 * is a port of the app's `ChapterText.reflow` (GutenbergKGKit), held to it by
 * the shared fixtures in
 * app/GutenbergKGKit/Tests/GutenbergKGKitTests/Fixtures/chapter_reflow.json.
 * `chapterBlocks` then cuts the result into paragraphs, each with the runs the
 * page shows and the plain text a voice says.
 */

/** A piece of a block's text and how the page sets it. */
export type Run = {
  text: string;
  /** italic and bold: `_x_` (which may span lines) and `**x**`. mark: a footnote mark such as `[1]`. aside: an inline `[Footnote: ...]` or `[Sidenote: ...]`. */
  style?: "italic" | "bold" | "mark" | "aside";
};

/**
 * One paragraph. prose has no line breaks; verse keeps them. heading is a
 * short line in capitals. note is a footnote or sidenote, caption an
 * illustration's; neither is spoken.
 */
export type Block = {
  kind: "prose" | "verse" | "heading" | "note" | "caption";
  runs: Run[];
  /** What a voice says: the text without markup, footnote marks or asides. Empty for note and caption. */
  spoken: string;
};

// ---- reflow: a line-for-line port of ChapterText.reflow -------------------

const LETTER = /\p{L}/u;
const LOWER = /\p{Lowercase}/u;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const EDGE_SPACE = /^[\p{Zs}\t]+|[\p{Zs}\t]+$/gu;

function startsLowercase(line: string): boolean {
  const first = line.match(LETTER)?.[0];
  return first ? LOWER.test(first) : false;
}

/** Character count as Swift counts it, near enough: code points, not UTF-16 units. */
function length(s: string): number {
  return [...s].length;
}

function isWrappedProse(lines: string[]): boolean {
  const rest = lines.slice(1);
  const lower = rest.filter(startsLowercase).length;
  let continuations = 0;
  for (let i = 0; i < rest.length; i++) {
    const last = [...lines[i]].at(-1);
    if (last === undefined) continue;
    if (startsLowercase(rest[i]) || LETTER_OR_NUMBER.test(last)) continuations++;
  }
  const averageLength = Math.floor(lines.reduce((n, l) => n + length(l), 0) / lines.length);
  return lower * 10 >= rest.length * 3 && continuations * 10 >= rest.length * 8 && averageLength >= 30;
}

function reflowParagraph(paragraph: string): string {
  const lines = paragraph.split("\n").map((l) => l.replace(EDGE_SPACE, "")).filter((l) => l !== "");
  if (lines.length <= 1) return lines[0] ?? "";
  if (isWrappedProse(lines)) return lines.join(" ");
  const out: string[] = [];
  for (const line of lines) {
    if (out.length > 0 && startsLowercase(line)) out[out.length - 1] += " " + line;
    else out.push(line);
  }
  return out.join("\n");
}

/**
 * Unwrap hard-wrapped prose; leave verse and lists as they are. See
 * ChapterText.reflow for the rule.
 *
 * :param text: A chapter's text.
 * :returns: The same text with paragraphs separated by one blank line.
 */
export function reflow(text: string): string {
  return text.replaceAll("\r\n", "\n").split("\n\n").map(reflowParagraph).filter((p) => p !== "").join("\n\n");
}

// ---- blocks ---------------------------------------------------------------

/** Bracketed blocks that may run over several paragraphs. */
const BRACKET_BLOCK = /^\[(Footnote|Illustration|Sidenote)\b/;
/** A footnote's body: `[1] A quotation from the Aeneid.` */
const NOTE_BODY = /^\[\d{1,3}\]\s/;
/** A heading has two capitals at least, so a paragraph of "I." or "O!" stays prose. */
const TWO_CAPITALS = /\p{Lu}[\s\S]*\p{Lu}/u;
/** The furthest a bracketed block is followed looking for its `]`. */
const MAX_BRACKET_PARAGRAPHS = 30;

/**
 * Inline markup. `_x_` opens only where a word does not, so `C_{2}H` is left
 * alone, and may close inside one, as in `_my_self`. The character before an
 * opening `_` is captured rather than looked behind at: Safari before 16.4
 * cannot parse a lookbehind, and one would stop the whole forest loading.
 */
const INLINE = /(^|[^\p{L}\p{N}])_(?=\S)([^_]*?[^_\s])_|\*\*([^*\n]+)\*\*|\[(\d{1,3})\]|\[((?:Footnote|Sidenote)\b[^\]]*)\]/gu;

function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index + (m[1]?.length ?? 0);
    if (start > at) runs.push({ text: text.slice(at, start) });
    if (m[2] !== undefined) runs.push({ text: m[2], style: "italic" });
    else if (m[3] !== undefined) runs.push({ text: m[3], style: "bold" });
    else if (m[4] !== undefined) runs.push({ text: m[4], style: "mark" });
    else runs.push({ text: m[5], style: "aside" });
    at = m.index + m[0].length;
  }
  if (at < text.length) runs.push({ text: text.slice(at) });
  return runs;
}

function spokenText(runs: Run[]): string {
  return runs
    .filter((r) => r.style !== "mark" && r.style !== "aside")
    .map((r) => r.text)
    .join("")
    // A stage direction is read, its brackets are not; an underscore left
    // unpaired (italics the source carries across paragraphs) is not said either.
    .replace(/[[\]_]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
}

/** Bracket depth change across a string. */
function bracketBalance(s: string): number {
  let n = 0;
  for (const ch of s) n += ch === "[" ? 1 : ch === "]" ? -1 : 0;
  return n;
}

/** The block for a bracketed paragraph: `[Illustration: x]` is a caption, the rest are notes. */
function bracketBlock(text: string): Block | null {
  const m = text.match(/^\[(Footnote|Illustration|Sidenote)\b[\s\d]*:?\s*([\s\S]*?)\]?$/);
  const label = m?.[1] ?? "Footnote";
  const body = (m?.[2] ?? text).trim();
  if (label === "Illustration") {
    // "[Illustration]" and "[Illustration: 0202]" (a plate number) have nothing to show.
    return /^\d*$/.test(body) ? null : { kind: "caption", runs: inlineRuns(body), spoken: "" };
  }
  return { kind: "note", runs: inlineRuns(text.replace(/^\[|\]$/g, "")), spoken: "" };
}

/** Lower case, punctuation and "(Part n of m)" gone, for comparing a title with a line. */
function titleKey(s: string): string {
  return s.replace(/\(Part \d+ of \d+\)/i, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
}

/**
 * Cut a chapter into blocks.
 *
 * :param text: The chapter's text as stored: hard-wrapped, with markup.
 * :param title: The chapter's title; a first line that only repeats it is dropped.
 * :returns: The blocks in reading order.
 */
export function chapterBlocks(text: string, title = ""): Block[] {
  const paragraphs = reflow(text).split("\n\n");
  const blocks: Block[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    let p = paragraphs[i];
    if (/^-{3,}$/.test(p)) continue; // the export's rule under the author line

    if (BRACKET_BLOCK.test(p)) {
      // A caption or footnote that runs on: gather paragraphs until its bracket closes.
      let depth = bracketBalance(p);
      let j = i;
      while (depth > 0 && j + 1 < paragraphs.length && j - i < MAX_BRACKET_PARAGRAPHS) {
        j++;
        p += "\n\n" + paragraphs[j];
        depth += bracketBalance(paragraphs[j]);
      }
      // Never closed (the source dropped the "]"): the first paragraph alone is the note or caption.
      if (depth === 0) i = j;
      else p = paragraphs[i];
      const block = bracketBlock(p);
      if (block) blocks.push(block);
      continue;
    }

    if (NOTE_BODY.test(p)) {
      blocks.push({ kind: "note", runs: inlineRuns(p), spoken: "" });
      continue;
    }

    const runs = inlineRuns(p);
    const plain = runs.map((r) => r.text).join("");
    const kind: Block["kind"] = p.includes("\n")
      ? "verse"
      : length(plain) <= 80 && TWO_CAPITALS.test(plain) && !LOWER.test(plain)
        ? "heading"
        : "prose";
    if (blocks.length === 0 && title && titleKey(plain) === titleKey(title)) continue;
    blocks.push({ kind, runs, spoken: spokenText(runs) });
  }
  return blocks;
}

/**
 * A verse block's runs cut at its line breaks, so each line can be set with
 * a hanging indent. A run that crosses a break is split in two.
 *
 * :param runs: A block's runs.
 * :returns: One list of runs per line.
 */
export function blockLines(runs: Run[]): Run[][] {
  const lines: Run[][] = [[]];
  for (const run of runs) {
    run.text.split("\n").forEach((text, i) => {
      if (i > 0) lines.push([]);
      if (text) lines[lines.length - 1].push({ ...run, text });
    });
  }
  return lines;
}
