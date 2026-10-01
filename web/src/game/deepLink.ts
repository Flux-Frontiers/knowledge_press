import type { TreeSite } from "./forest";

/**
 * The tree a `?tree=<slug>` address names, or undefined. The slug is the
 * catalog's, the file name of the book's text, e.g. `?tree=hamlet`. An
 * unknown slug is ignored so the forest opens at home as usual.
 */
export function treeFromSearch(search: string, trees: Pick<TreeSite, "book">[]): TreeSite | undefined {
  const slug = new URLSearchParams(search).get("tree")?.trim().toLowerCase();
  if (!slug) return undefined;
  return trees.find((t) => t.book.slug === slug) as TreeSite | undefined;
}
