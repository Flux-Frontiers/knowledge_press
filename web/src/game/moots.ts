/**
 * Saved moots: two books talking, as `gutenkg export-web-moots` writes them
 * into moots/. index.json lists every moot; moots/<id>.json holds one, version
 * MOOT_VERSION. A tree is named by its worker key, "<genre>/<book>", which the
 * catalog carries as `genre` and `book`.
 */

import type { Book } from "./catalogTypes";

export const MOOT_VERSION = 1;

/** The first and second tree's colors: their bubbles, their names in the text, their ring in the forest. */
export const MOOT_COLORS = ["#9fd38a", "#e39ad9"] as const;

export type MootEntry = { id: string; title: string; topic: string | null; trees: string[]; turns: number; date: string };
export type MootTree = { key: string; title: string; author: string };
export type MootCite = { tag: string; label: string; node_id: string };
export type MootTurn = { turn: number; speaker: 0 | 1; text: string; cites: MootCite[]; grounded: boolean };
export type Moot = {
  id: string;
  topic: string | null;
  date: string;
  model: string;
  backend: string;
  trees: [MootTree, MootTree];
  turns: MootTurn[];
};

export class MootError extends Error {}

const isString = (v: unknown): v is string => typeof v === "string";

/**
 * Check index.json's shape: [{id, title, topic, trees, turns, date}, ...].
 *
 * :param data: The parsed file.
 * :returns: The entries, newest first as written.
 */
export function decodeIndex(data: unknown): MootEntry[] {
  if (!Array.isArray(data)) throw new MootError("moot index is not a list");
  for (const e of data) {
    if (!isString(e?.id) || !isString(e?.title) || !Array.isArray(e?.trees) || typeof e?.turns !== "number" || !isString(e?.date)) {
      throw new MootError("moot index has a malformed entry");
    }
  }
  return data as MootEntry[];
}

/**
 * Check a moot pack's version and shape.
 *
 * :param data: The parsed moots/<id>.json.
 * :returns: The moot, its turns in speaking order.
 */
export function decodeMoot(data: unknown): Moot {
  const m = data as Partial<Moot> & { version?: unknown } | null;
  if (m?.version !== MOOT_VERSION) throw new MootError(`moot pack version ${String(m?.version)} is not ${MOOT_VERSION}`);
  if (!isString(m.id) || !Array.isArray(m.trees) || m.trees.length !== 2 || !Array.isArray(m.turns)) {
    throw new MootError("moot pack needs an id, two trees and a list of turns");
  }
  for (const t of m.trees) {
    if (!isString(t?.key) || !isString(t?.title)) throw new MootError("moot pack has a malformed tree");
  }
  for (const t of m.turns) {
    if (typeof t?.turn !== "number" || (t.speaker !== 0 && t.speaker !== 1) || !isString(t.text) || !Array.isArray(t.cites)) {
      throw new MootError("moot pack has a malformed turn");
    }
  }
  return { ...m, turns: [...m.turns].sort((a, b) => a.turn - b.turn) } as Moot;
}

/**
 * The catalog book for each of a moot's trees, matched by "<genre>/<book>".
 * A key the catalog does not hold gives `undefined`; the moot still plays
 * under the pack's own title.
 *
 * :param moot: The moot.
 * :param books: The catalog.
 */
export function mootBooks(moot: Moot, books: readonly Book[]): [Book | undefined, Book | undefined] {
  const byKey = new Map(books.map((b) => [`${b.genre}/${b.book}`, b]));
  return [byKey.get(moot.trees[0].key), byKey.get(moot.trees[1].key)];
}

export type Span = { text: string; kind: "plain" | "name" | "quote" | "tag"; side?: 0 | 1 };

const OPEN_DQ = String.fromCharCode(0x201c);
const CLOSE_DQ = String.fromCharCode(0x201d);
/** Quoted words, in straight or curly marks; the CLI's pattern. */
const QUOTED = `["${OPEN_DQ}][^"${CLOSE_DQ}]+["${CLOSE_DQ}]`;
/** Citation tags such as [s1], [o3] or (s1, s2). */
const TAGS = String.raw`[\[(][soSO]\d+(?:\s*,\s*[soSO]\d+)*[\])]`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split a turn's text for display: each tree's name, quoted words and
 * citation tags as their own spans, the rest plain. Where two overlap the
 * leftmost wins, and a name before a quote at the same place.
 *
 * :param text: The turn's text.
 * :param names: The two trees' titles, first tree first.
 */
export function markText(text: string, names: readonly [string, string]): Span[] {
  const named = names.map((n, side) => ({ n, side: side as 0 | 1 })).filter((x) => x.n).sort((a, b) => b.n.length - a.n.length);
  const parts = [...named.map((x) => `(${escape(x.n)})`), `(${QUOTED})`, `(${TAGS})`];
  const re = new RegExp(parts.join("|"), "g");
  const spans: Span[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) spans.push({ text: text.slice(at, m.index), kind: "plain" });
    const group = m.findIndex((g, i) => i > 0 && g !== undefined) - 1;
    if (group < named.length) spans.push({ text: m[0], kind: "name", side: named[group]!.side });
    else spans.push({ text: m[0], kind: group === named.length ? "quote" : "tag" });
    at = m.index + m[0].length;
  }
  if (at < text.length) spans.push({ text: text.slice(at), kind: "plain" });
  return spans;
}

/** A turn's text as it is spoken: without its citation tags. */
export function spokenText(text: string): string {
  return text.replace(new RegExp(String.raw`\s*` + TAGS, "g"), "").replace(/\s+/g, " ").trim();
}

/**
 * How long a turn stays before the next appears when it is not spoken: at
 * about 180 words a minute, never under four seconds.
 *
 * :param text: The turn's text.
 * :returns: Milliseconds.
 */
export function readingMs(text: string): number {
  const words = spokenText(text).split(" ").filter(Boolean).length;
  return Math.max(4000, Math.round((words / 3) * 1000));
}

let index: Promise<MootEntry[]> | null = null;
const moots = new Map<string, Promise<Moot>>();

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  if (!res.ok) throw new MootError(`not found (HTTP ${res.status})`);
  // Vite answers a missing file with index.html, so a parse failure means the same.
  return res.json().catch(() => { throw new MootError("not found"); });
}

/** Every saved moot, fetched once; a failed fetch is forgotten so the next call tries again. */
export function getMootIndex(): Promise<MootEntry[]> {
  if (!index) {
    index = fetchJson("moots/index.json").then(decodeIndex);
    index.catch(() => { index = null; });
  }
  return index;
}

/**
 * One moot, fetched once and shared by every later call.
 *
 * :param id: The moot's id, from the index.
 */
export function getMoot(id: string): Promise<Moot> {
  let moot = moots.get(id);
  if (!moot) {
    moot = fetchJson(`moots/${encodeURIComponent(id)}.json`).then(decodeMoot);
    moot.catch(() => moots.delete(id));
    moots.set(id, moot);
  }
  return moot;
}
