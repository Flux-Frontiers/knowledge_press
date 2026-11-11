export type Book = {
  slug: string;
  title: string;
  /** The worker's key for the book: its corpus folder name, which the title can differ from. */
  book: string;
  author: string;
  genre: string;
  genreLabel: string;
  chunks: number;
  excerpt: string;
  tags: string[];
  /**
   * Literary year: first published, performed, or (ancient and sacred texts)
   * composed. Negative is BC. Absent when the corpus has no date for the work.
   */
  year?: number;
  /**
   * Diaries only: one limb per period (a calendar year when dated), earliest
   * first. `bins` counts the period's chunks in equal slices along its limb,
   * by each entry's fraction of the year; trailing empty slices are dropped.
   */
  periods?: Period[];
};

export type Period = { label: string; entries: number; bins: number[] };
