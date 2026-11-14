/**
 * A book read aloud chapter after chapter, whether or not its reader is open.
 *
 * speech.ts reads one chapter's blocks; this goes on to the next chapter at
 * the end of each and tells the page (the reader, the HUD strip, the store)
 * where the reading is. Closing the reader leaves it going; only stopBook,
 * or the last chapter's end, finishes it.
 */

import type { Chapter } from "./bookText";
import { chapterBlocks, type Block } from "./chapterBlocks";
import { pauseReading, readAloud, resumeReading, stopReading, type ReadingState, type VoiceWant } from "./speech";

/** Where a book being read aloud is. */
export type BookReading = {
  slug: string;
  title: string;
  chapter: number;
  chapterTitle: string;
  block: number;
  state: Exclude<ReadingState, "idle">;
};

/** A book to read aloud from a chapter and block. */
export type BookRequest = {
  slug: string;
  title: string;
  chapters: readonly Chapter[];
  chapter: number;
  from: number;
  /** The author's gender and accent, for the automatic voice. */
  want?: VoiceWant;
  /** The voice chosen in Settings; "" for automatic. */
  chosen?: string;
  rate?: number;
  /** Called on every change of state, chapter or block; null once the reading is over. */
  onUpdate: (reading: BookReading | null) => void;
};

/**
 * One chapter's blocks, as the reader shows them: a chapter's title heads it
 * only when the book has more than one.
 *
 * :param chapters: The book's chapters.
 * :param index: The chapter.
 */
export function blocksOf(chapters: readonly Chapter[], index: number): Block[] {
  const c = chapters[index];
  return c ? chapterBlocks(c.text, chapters.length > 1 ? c.title : "") : [];
}

let book: { request: BookRequest; reading: BookReading | null } | null = null;

function readChapter(session: NonNullable<typeof book>, chapter: number, from: number): void {
  const { request } = session;
  readAloud({
    blocks: blocksOf(request.chapters, chapter).map((b) => b.spoken),
    from,
    want: request.want,
    chosen: request.chosen,
    rate: request.rate,
    onChange: (state, block) => {
      // "idle" comes from a chapter's end (onDone follows) or a stop (stopBook reports it).
      if (book !== session || state === "idle") return;
      session.reading = {
        slug: request.slug, title: request.title, chapter, chapterTitle: request.chapters[chapter]?.title ?? "", block, state,
      };
      request.onUpdate(session.reading);
    },
    onDone: () => {
      if (book !== session) return;
      if (chapter + 1 < request.chapters.length) readChapter(session, chapter + 1, 0);
      else {
        book = null;
        request.onUpdate(null);
      }
    },
  });
}

/** Read a book aloud from a chapter and block, replacing any book being read. Call it from a tap the first time. */
export function readBook(request: BookRequest): void {
  book = { request, reading: null };
  readChapter(book, request.chapter, request.from);
}

/** Pause the book, or go on with it. */
export function toggleBook(): void {
  if (book?.reading?.state === "playing") pauseReading();
  else if (book?.reading?.state === "paused") resumeReading();
}

/** Stop reading the book and forget it. */
export function stopBook(): void {
  const session = book;
  if (!session) return;
  book = null;
  stopReading();
  session.request.onUpdate(null);
}

/** The book being read aloud, or null. */
export function currentBook(): BookReading | null {
  return book?.reading ?? null;
}
