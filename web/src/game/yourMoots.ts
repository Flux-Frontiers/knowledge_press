/**
 * The reader's own moots: each finished live moot, kept in this browser in the
 * same shape as a shipped moot, so it plays back with no worker. Apart from the
 * saved settings, so Reset all settings leaves them alone, as it does the press.
 */

import { decodeMoot, MOOT_VERSION, type Moot, type MootEntry } from "./moots";

const KEY = "kpf-your-moots-v1";

/** Every saved moot that still decodes, newest first. */
export function listYourMoots(): Moot[] {
  let stored: unknown;
  try {
    stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((data) => {
    try {
      return [decodeMoot(data)];
    } catch {
      return [];
    }
  });
}

function write(moots: Moot[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(moots.map((m) => ({ ...m, version: MOOT_VERSION }))));
    return true;
  } catch {
    return false; // private mode, or storage full
  }
}

/**
 * Keep a finished moot.
 *
 * :param moot: The moot; it is stored under a new id, since holding the same
 *     books on the same topic again gives the same worker id.
 * :returns: Whether it was stored.
 */
export function saveYourMoot(moot: Moot): boolean {
  return write([{ ...moot, id: `yours-${Date.now()}` }, ...listYourMoots()]);
}

/** One saved moot, or undefined when the id is not one of the reader's. */
export function yourMoot(id: string): Moot | undefined {
  return listYourMoots().find((m) => m.id === id);
}

/** Remove one saved moot. */
export function deleteYourMoot(id: string): void {
  write(listYourMoots().filter((m) => m.id !== id));
}

/** A saved moot as a row of the Moots list, titled as the shipped index titles them. */
export function yourMootEntry(moot: Moot): MootEntry {
  const books = `${moot.trees[0].title} and ${moot.trees[1].title}`;
  return {
    id: moot.id,
    title: moot.topic ? `${books} on ${moot.topic}` : books,
    topic: moot.topic,
    trees: moot.trees.map((t) => t.key),
    turns: moot.turns.length,
    date: moot.date,
  };
}
