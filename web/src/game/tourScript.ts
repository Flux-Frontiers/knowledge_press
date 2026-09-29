/**
 * What the guided tour says apart from the grove summaries (narration.ts):
 * the welcome and background at the start, a word when the ring is done, and
 * a goodbye. Every line is a variable here so the copy can be edited without
 * touching the tour. `{books}` and `{groves}` are filled from
 * the forest (`fillScript`), so the numbers follow the catalog.
 */

/** The greeting. */
export const TOUR_WELCOME = "Welcome to the Knowledge Press, a library grown as a forest.";

/** How the forest is made. */
export const TOUR_ABOUT =
  "Each of its {books} books is a tree, taller the longer it is, and the trees gather into {groves} groves by genre.";

/** How to take over. */
export const TOUR_TIPS = "Steer at any time to take the wheel.";

/** Said in place of the three above on every tour after the first on this device. */
export const TOUR_WELCOME_BACK = "Welcome back. Off around the ring we go.";

/** Said once, when the cart has visited every grove and starts round again. */
export const TOUR_LAP_DONE =
  "That was every grove on the ring. The tour keeps going round; take the wheel whenever you like.";

/** Said when the rider takes the wheel. */
export const TOUR_FAREWELL = "You have the wheel. Ride the ring again any time.";

export type TourFacts = { books: number; groves: number };

/** `text` with `{books}` and `{groves}` replaced. */
export function fillScript(text: string, facts: TourFacts): string {
  return text
    .replace(/\{books\}/g, String(facts.books))
    .replace(/\{groves\}/g, String(facts.groves));
}

/**
 * What is said as the tour sets off, one string per utterance: the full
 * welcome and background the first time, a line after that.
 *
 * :param heard: The rider has been through the full welcome before.
 */
export function tourIntro(facts: TourFacts, heard: boolean): string[] {
  const lines = heard ? [TOUR_WELCOME_BACK] : [TOUR_WELCOME, TOUR_ABOUT, TOUR_TIPS];
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
