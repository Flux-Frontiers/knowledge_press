import type { TreeSite } from "./forest";

/**
 * The tree a `?tree=<slug>` address names, or undefined. The slug is the
 * catalog's, the file name of the book's text, e.g. `?tree=hamlet`. An
 * unknown slug is ignored so the forest opens at home as usual.
 */
export function treeFromSearch(search: string, trees: Pick<TreeSite, "book">[]): TreeSite | undefined {
  const slug = new URLSearchParams(search).get("tree");
  return slug ? treeBySlug(slug, trees) : undefined;
}

/**
 * The tree for a catalog slug, or undefined. Shared by `?tree=` and the app
 * host's `goto` command (host.ts), which lands the same way without a reload.
 */
export function treeBySlug(slug: string, trees: Pick<TreeSite, "book">[]): TreeSite | undefined {
  const key = slug.trim().toLowerCase();
  if (!key) return undefined;
  return trees.find((t) => t.book.slug === key) as TreeSite | undefined;
}

/**
 * The address with `?tree=` set to a slug, or removed for null, other
 * parameters kept. A reload (the app reloads a forest whose web process was
 * killed) then lands where the host last sent the forest.
 */
export function searchWithTree(search: string, slug: string | null): string {
  const params = new URLSearchParams(search);
  if (slug) params.set("tree", slug);
  else params.delete("tree");
  const text = params.toString();
  return text ? `?${text}` : "";
}
