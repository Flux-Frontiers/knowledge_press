/**
 * Reads a book's text from books/<slug>.json, the static files `gutenkg
 * export-web-books` writes, so the published site reads books without a
 * worker. Each file holds every chapter; a book is fetched once per session.
 */

export type Chapter = { title: string; text: string };

export class BookTextError extends Error {}

/**
 * Check a book file's shape: {"chapters": [{"title", "text"}, ...]}.
 *
 * :param data: The parsed file.
 * :returns: The chapters, in reading order.
 */
export function decodeBook(data: unknown): Chapter[] {
  const chapters = (data as { chapters?: unknown } | null)?.chapters;
  if (!Array.isArray(chapters)) throw new BookTextError("book file has no chapter list");
  for (const c of chapters) {
    if (typeof c?.title !== "string" || typeof c?.text !== "string") throw new BookTextError("book file has a malformed chapter");
  }
  return chapters as Chapter[];
}

const books = new Map<string, Promise<Chapter[]>>();

/**
 * A book's chapters, fetched once and shared by every later call.
 * A failed fetch is forgotten, so the next call tries again.
 *
 * :param slug: The catalog slug.
 */
export function getBook(slug: string): Promise<Chapter[]> {
  let book = books.get(slug);
  if (!book) {
    book = fetch(`books/${encodeURIComponent(slug)}.json`).then(async (res) => {
      if (!res.ok) throw new BookTextError(`the text was not found (HTTP ${res.status})`);
      // Vite answers a missing file with index.html, so a parse failure means the same.
      const data = await res.json().catch(() => { throw new BookTextError("the text was not found"); });
      return decodeBook(data);
    });
    book.catch(() => books.delete(slug));
    books.set(slug, book);
  }
  return book;
}
