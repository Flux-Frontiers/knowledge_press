/**
 * The forest by literary date: each tree appears in its work's year (catalog
 * `year`, from gutenberg_kg's corpus/pub_dates.tsv). The layout never changes;
 * the timeline only hides the trees whose year has not come yet.
 */

/** What the timeline needs of a book. */
export type DatedBook = { year?: number; genre: string; chunks: number };

/** One step of the slider: a year some work appeared, and the forest's totals once it has. */
export type TimelineStop = {
  year: number;
  /** Works first appearing this year. */
  added: number;
  books: number;
  groves: number;
  chunks: number;
  /** Exhibits first standing this year, by label; absent when none. */
  exhibits?: string[];
};

/** The shader's year while the timeline is off: later than any work. */
export const TIMELINE_OFF = 1e6;

/**
 * Whether a book's tree stands at the timeline's year.
 *
 * :param book: The book; one with no year stands from the start.
 * :param year: The timeline's year, or null when the timeline is off.
 */
export function bookShown(book: { year?: number }, year: number | null): boolean {
  return year === null || book.year === undefined || book.year <= year;
}

/**
 * The slider's stops: one per distinct year a work or an exhibit appeared, earliest
 * first, with running totals. Undated books count from the first stop; undated
 * exhibits stand throughout and make no stop. Stepping by year, not by time, keeps
 * the slider from spending most of its travel on the empty centuries before 1500.
 *
 * :param books: Every book in the forest.
 * :param exhibits: The forest's exhibits.
 */
export function timelineStops(books: readonly DatedBook[], exhibits: readonly { year?: number; label: string }[] = []): TimelineStop[] {
  const dated = books.filter((b) => b.year !== undefined).sort((a, b) => a.year! - b.year!);
  const undated = books.filter((b) => b.year === undefined);
  const groves = new Set(undated.map((b) => b.genre));
  let count = undated.length;
  let chunks = undated.reduce((n, b) => n + b.chunks, 0);
  const years = [...new Set([...dated, ...exhibits].flatMap((d) => (d.year === undefined ? [] : [d.year])))].sort((a, b) => a - b);
  let i = 0;
  return years.map((year, k) => {
    let added = k === 0 ? undated.length : 0;
    for (; i < dated.length && dated[i]!.year === year; i++) {
      added += 1;
      count += 1;
      chunks += dated[i]!.chunks;
      groves.add(dated[i]!.genre);
    }
    const stop: TimelineStop = { year, added, books: count, groves: groves.size, chunks };
    const arriving = exhibits.filter((e) => e.year === year).map((e) => e.label);
    if (arriving.length) stop.exhibits = arriving;
    return stop;
  });
}

/**
 * A year as a reader would write it: 1000 BC, AD 632, 1859.
 *
 * :param year: Signed year; negative is BC.
 */
export function yearLabel(year: number): string {
  if (year < 0) return `${-year} BC`;
  return year < 1000 ? `AD ${year}` : String(year);
}
