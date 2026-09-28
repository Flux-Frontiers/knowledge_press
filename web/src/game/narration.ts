import type { Book } from "./catalogTypes";

/**
 * What the guided tour says at each grove: a short summary generated from the
 * catalog, so a new book changes it with nothing written by hand. It names the
 * grove, how many books it holds and by whom, its longest book, and for
 * diaries the years their entries span.
 */

/** Catalog authors whose Project Gutenberg form reads badly aloud. */
const SPOKEN_NAMES: Record<string, string> = {
  "Leo, graf Tolstoy": "Leo Tolstoy",
  "of Hippo, Saint Augustine": "Saint Augustine of Hippo",
  "Adam, Captain Seaborn": "Captain Adam Seaborn",
  "Emperor of Rome Marcus Aurelius": "Marcus Aurelius",
  "da Pisa Rusticiano": "Rustichello da Pisa",
  "the Younger Pliny": "Pliny the Younger",
};

/**
 * An author's name as it should be spoken: expansions in parentheses dropped
 * ("H. P. (Howard Phillips) Lovecraft" -> "H. P. Lovecraft") and a title after
 * the name dropped ("George Gordon Byron, Baron Byron" -> "George Gordon Byron").
 * Null for an unknown author.
 */
export function spokenAuthor(author: string): string | null {
  if (!author || author === "Unknown" || author === "Anonymous" || author === "Various") return null;
  if (SPOKEN_NAMES[author]) return SPOKEN_NAMES[author]!;
  const plain = author.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const [head] = plain.split(",");
  return head!.includes(" ") ? head!.trim() : plain;
}

/** True when `text` names the author: a word of three letters or more in common. */
function namesAuthor(text: string, author: string): boolean {
  const words = (x: string) => x.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length >= 3);
  const own = new Set(words(author));
  return words(text).some((w) => own.has(w));
}

/**
 * A title as it should be spoken, without the catalog's disambiguators: a
 * trailing author ("Confessions — Saint Augustine", "Bleak House (Dickens)")
 * or "— Complete" goes, a volume or a translation stays ("The Portrait of a
 * Lady, Volume 1", "The Divine Comedy (Cary's Translation)").
 */
export function spokenTitle(title: string, author: string): string {
  let t = title.trim().replace(/\.$/, "");
  const paren = t.match(/^(.*\S)\s*\(([^)]*)\)$/);
  if (paren && namesAuthor(paren[2]!, author)) t = paren[1]!;
  const [head, ...rest] = t.split(" — ");
  if (!rest.length) return t;
  const tail = rest.join(" — ").replace(/\s*\([^)]*\)$/, "");
  return tail === "Complete" || namesAuthor(tail, author) ? head! : `${head}, ${tail}`;
}

/** "A", "A and B", "A, B and C". */
function list(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The grove's summary, a few sentences to show and to speak.
 *
 * :param label: The grove's name, e.g. "American Literature".
 * :param books: The grove's books.
 */
export function groveNarration(label: string, books: Book[]): string {
  if (!books.length) return `${label}.`;
  // Authors in order of how much of the grove they wrote.
  const weight = new Map<string, number>();
  for (const b of books) {
    const name = spokenAuthor(b.author);
    if (name) weight.set(name, (weight.get(name) ?? 0) + b.chunks);
  }
  const authors = [...weight.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  const longest = [...books].sort((a, b) => b.chunks - a.chunks || a.title.localeCompare(b.title))[0]!;
  const longestBy = spokenAuthor(longest.author);
  const longestTitle = spokenTitle(longest.title, longest.author);
  const out: string[] = [];

  if (books.length === 1) {
    out.push(`${label}: one book, ${longestTitle}${longestBy ? `, by ${longestBy}` : ""}.`);
  } else {
    const named = authors.slice(0, 3);
    const more = authors.length - named.length;
    const names = list(more > 0 ? [...named, `${more} more ${more === 1 ? "author" : "authors"}`] : named);
    // "by" only when every book has a known author; otherwise the named ones are a sample.
    const anonymous = books.some((b) => !spokenAuthor(b.author));
    const by = !named.length ? "" : anonymous ? `, including work by ${names}` : ` by ${names}`;
    out.push(`${label}: ${books.length} books${by}.`);
    out.push(`The longest is ${longestTitle}${longestBy ? `, by ${longestBy}` : ""}.`);
  }

  // Diaries carry their entries' years.
  const years = books.flatMap((b) => (b.periods ?? []).map((p) => Number(p.label))).filter((y) => Number.isInteger(y) && y > 0);
  if (years.length) {
    const lo = Math.min(...years), hi = Math.max(...years);
    out.push(lo === hi ? `The entries date from ${lo}.` : `The entries run from ${lo} to ${hi}.`);
  }
  return out.join(" ");
}
