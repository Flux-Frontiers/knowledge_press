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
};
