/**
 * What the guided tour says apart from the grove summaries (narration.ts):
 * the welcome and background at the start, a word when the ring is done, and
 * a goodbye. Every line is a variable here so the copy can be edited without
 * touching the tour. `{books}`, `{groves}` and `{exhibits}` are filled from
 * the forest (`fillScript`), so the numbers follow the catalog.
 */

/** The greeting. */
export const TOUR_WELCOME =
  "Welcome to the Knowledge Press. This forest is a library, and you are riding its ring road in a lantern cart.";

/** How the forest is made. */
export const TOUR_ABOUT =
  "Each of the {books} books here is a Project Gutenberg text in the public domain, grown as a tree. "
  + "The more text a book has, the taller its tree, and its leaves stand for passages from it. "
  + "The trees are gathered into {groves} groves by genre, and each genre has its own kind of tree.";

/** The hub and the side roads. */
export const TOUR_REDWOOD =
  "At the center stands the Corpus Redwood, one tree for the whole library, with a limb reaching toward every book. "
  + "Along the rings, side roads lead to {exhibits} exhibits.";

/** What the tour will do, and how to take over. */
export const TOUR_TIPS =
  "We will stop at each grove's signpost for a short summary. Steer, brake or reverse to take the wheel at any time.";

/** Said in place of the four above on every tour after the first on this device. */
export const TOUR_WELCOME_BACK = "Welcome back. Off around the ring we go.";

/** Said once, when the cart has visited every grove and starts round again. */
export const TOUR_LAP_DONE =
  "That was every grove on the ring. The tour keeps going round; take the wheel whenever you like.";

/** Said when the rider takes the wheel. */
export const TOUR_FAREWELL = "You have the wheel. Ride the ring again any time.";

export type TourFacts = { books: number; groves: number; exhibits: number };

/** `text` with `{books}`, `{groves}` and `{exhibits}` replaced. */
export function fillScript(text: string, facts: TourFacts): string {
  return text
    .replace(/\{books\}/g, String(facts.books))
    .replace(/\{groves\}/g, String(facts.groves))
    .replace(/\{exhibits\}/g, String(facts.exhibits));
}

/**
 * What is said as the tour sets off, one string per utterance: the full
 * welcome and background the first time, a line after that.
 *
 * :param heard: The rider has been through the full welcome before.
 */
export function tourIntro(facts: TourFacts, heard: boolean): string[] {
  const lines = heard ? [TOUR_WELCOME_BACK] : [TOUR_WELCOME, TOUR_ABOUT, TOUR_REDWOOD, TOUR_TIPS];
  return lines.map((line) => fillScript(line, facts));
}

const HEARD_KEY = "kpf-tour-heard";

/** True once the full welcome has been given on this device. */
export function tourHeard(): boolean {
  try {
    return window.localStorage.getItem(HEARD_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTourHeard(): void {
  try {
    window.localStorage.setItem(HEARD_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}
