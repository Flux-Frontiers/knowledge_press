/**
 * The reader's bookmarks: places in a book, each a chapter index and a block
 * index, kept with the preferences by book slug (preferences.bookmarks).
 */

import type { Block } from "./chapterBlocks";

export type Mark = [chapter: number, block: number];

/** Whether a place is bookmarked. */
export function isMarked(marks: readonly Mark[], chapter: number, block: number): boolean {
  return marks.some(([c, b]) => c === chapter && b === block);
}

/**
 * Bookmark a place, or take its bookmark away; the list stays in reading order.
 *
 * :param marks: The book's bookmarks.
 * :param chapter: The chapter index.
 * :param block: The block index in it.
 */
export function toggleMark(marks: readonly Mark[], chapter: number, block: number): Mark[] {
  if (isMarked(marks, chapter, block)) return marks.filter(([c, b]) => c !== chapter || b !== block);
  return [...marks, [chapter, block] as Mark].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

/** A block's first words, cut at a word, for the bookmark list. */
export function excerpt(block: Block | undefined, length = 60): string {
  const flat = (block?.runs.map((r) => r.text).join("") ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= length) return flat;
  const cut = flat.slice(0, length);
  const space = cut.lastIndexOf(" ");
  return `${space > 0 ? cut.slice(0, space) : cut}...`;
}
