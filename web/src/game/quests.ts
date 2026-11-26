import { BOOKS } from "./catalog";

export type Quest = {
  id: string;
  title: string;
  hint: string;
  done: (s: { library: string[]; grovesVisited: string[]; season: string }) => boolean;
};

const STOIC = new Set(
  BOOKS.filter((b) => b.tags.includes("stoic") || /epictetus|aurelius|meditations|enchiridion/i.test(b.title + b.author)).map(
    (b) => b.slug,
  ),
);

/** Slugs of the books by an author, or in a genre. */
const by = (author: string) => new Set(BOOKS.filter((b) => b.author === author).map((b) => b.slug));
const RUSSIAN = new Set(BOOKS.filter((b) => b.genre === "russian-literature").map((b) => b.slug));
const LOVECRAFT = by("H. P. Lovecraft");
const VERNE = by("Jules Verne");
/** Every genre has a grove. */
const GENRES = new Set(BOOKS.map((b) => b.genre));
const count = (library: string[], set: ReadonlySet<string>) => library.filter((id) => set.has(id)).length;
const all = (library: string[], slugs: string[]) => slugs.every((id) => library.includes(id));

export const QUESTS: Quest[] = [
  {
    id: "three",
    title: "First impressions",
    hint: "Read three trees. Drive close and press E.",
    done: (s) => s.library.length >= 3,
  },
  {
    id: "stoic",
    title: "A Stoic",
    hint: "Meditations, Epictetus, or the Enchiridion — philosophy and the classics.",
    done: (s) => s.library.some((id) => STOIC.has(id)),
  },
  {
    id: "hamlet",
    title: "The Dane",
    hint: "Shakespeare’s grove is small. Hamlet is 420 leaves on 305 limbs.",
    done: (s) => s.library.includes("hamlet"),
  },
  {
    id: "winter",
    title: "Bare wood",
    hint: "Switch to winter. The pipe model is the point.",
    done: (s) => s.season === "winter" && s.library.length >= 1,
  },
  {
    id: "wander",
    title: "Across the press",
    hint: "Visit four genre groves.",
    done: (s) => s.grovesVisited.length >= 4,
  },
  {
    id: "ten",
    title: "A full cart",
    hint: "Press ten books.",
    done: (s) => s.library.length >= 10,
  },
  {
    id: "tragedies",
    title: "Three tragedies",
    hint: "Hamlet, Macbeth, and Romeo and Juliet, all in Shakespeare's grove.",
    done: (s) => all(s.library, ["hamlet", "macbeth", "romeo_and_juliet"]),
  },
  {
    id: "lovecraft",
    title: "Lovecraft country",
    hint: "Press three of Lovecraft's tales. The horror grove keeps them.",
    done: (s) => count(s.library, LOVECRAFT) >= 3,
  },
  {
    id: "barsoom",
    title: "Barsoom",
    hint: "A Princess of Mars, The Gods of Mars and The Warlord of Mars.",
    done: (s) => all(s.library, ["a_princess_of_mars", "the_gods_of_mars", "the_warlord_of_mars"]),
  },
  {
    id: "verne",
    title: "Extraordinary voyages",
    hint: "Press three of Jules Verne's novels.",
    done: (s) => count(s.library, VERNE) >= 3,
  },
  {
    id: "russian-winter",
    title: "A Russian winter",
    hint: "Switch to winter with a Russian novel pressed.",
    done: (s) => s.season === "winter" && count(s.library, RUSSIAN) >= 1,
  },
  {
    id: "founding",
    title: "Founding papers",
    hint: "The Federalist Papers, Common Sense and the Second Treatise of Government.",
    done: (s) => all(s.library, ["the_federalist_papers", "common_sense", "second_treatise_of_government"]),
  },
  {
    id: "every-grove",
    title: "Every grove",
    hint: "Visit every genre grove in the forest.",
    done: (s) => [...GENRES].every((g) => s.grovesVisited.includes(g)),
  },
];

/** Quests done: those already earned (saved) and those `s` meets now. */
export function questProgress(s: { library: string[]; grovesVisited: string[]; season: string }, earned: readonly string[] = []) {
  const done = QUESTS.filter((q) => earned.includes(q.id) || q.done(s)).length;
  return { done, total: QUESTS.length };
}

/** Quests done in `s` that are not in `seen`: the ones to announce. */
export function freshlyDone(seen: ReadonlySet<string>, s: { library: string[]; grovesVisited: string[]; season: string }): Quest[] {
  return QUESTS.filter((q) => !seen.has(q.id) && q.done(s));
}
