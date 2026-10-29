import { useEffect, useMemo, useRef } from "react";
import { BOOKS } from "./catalog";
import { COARSE_POINTER } from "./Environment";
import { USER_GUIDE_URL } from "./links";
import { NightSky } from "./NightSky";
import { SPECIES, speciesFor } from "./species";
import { useGame } from "./store";

/** Every control, keyboard first; a touch screen gets its own list. */
const KEYS: [string, string][] = [
  ["W / S", "drive forward, reverse"],
  ["A / D", "steer"],
  ["Drag, or arrows", "look around; the view eases back to ahead when you let go, the tilt stays"],
  ["Shift / Space", "hurry / brake"],
  ["E", "read the nearest tree"],
  ["G / B / L", "the grove atlas, every book, your press"],
  ["H / Q", "home to the redwood / the guided tour"],
  ["C", "camera: behind, high, in the cart, god's eye"],
  ["?", "this page, at this list"],
  ["Esc", "close a panel; with none open, settings"],
];

const TOUCH: [string, string][] = [
  ["Stick, bottom left", "drive: up forward, down reverse, sideways to steer"],
  ["Drag anywhere else", "look around; the view eases back to ahead when you let go"],
  ["Read", "the nearest tree, once you are close"],
  ["Guided tour", "the cart drives the ring and stops at each grove"],
  ["Three-dot menu", "time of day, silent mode, screenshot, moots, settings, this page"],
];

/**
 * What the forest is, what is in it, what is in tonight's sky, and how to get
 * around: the long form of the start screen. Opened with ?, the About button
 * in the bar or the phone's three-dot menu, or About on the start screen; ?
 * opens it scrolled to the key list, the others at the top.
 */
export function About() {
  const open = useGame((s) => s.helpOpen);
  const at = useGame((s) => s.helpAt);
  const toggle = useGame((s) => s.toggleHelp);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const keys = useRef<HTMLHeadingElement>(null);
  // Each species with the genres that grow as it, in catalog order.
  const species = useMemo(() => {
    const labels = new Map(BOOKS.map((b) => [b.genre, b.genreLabel]));
    return SPECIES.map((s, i) => ({
      s,
      genres: [...labels].filter(([genre]) => speciesFor(genre) === i).map(([, label]) => label),
    })).filter((x) => x.genres.length);
  }, []);

  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      close.current?.focus({ preventScroll: true });
      if (at === "keys") keys.current?.scrollIntoView({ block: "start" });
      else dialog.current?.scrollTo({ top: 0 });
    } else dialog.current?.close();
  }, [open, at]);

  return (
    <dialog ref={dialog} aria-labelledby="about-title" onCancel={(e) => { e.preventDefault(); toggle(); }}
      onClick={(e) => { if (e.target === e.currentTarget) toggle(); }}
      className="about m-auto max-h-[90dvh] w-[min(100%-2rem,40rem)] overflow-auto rounded-xl border border-border bg-surface text-fg shadow-2xl">
      {/* Padding inside, so a click on the dialog itself is a click on the backdrop. */}
      <div className="p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">The Knowledge Press</p>
          <h2 id="about-title" className="mt-1 font-display text-3xl">About the forest</h2>
        </div>
        <button ref={close} type="button" aria-label="Close" onClick={() => toggle()}
          className="grid size-11 shrink-0 place-items-center rounded-md border border-border text-xl leading-none">×</button>
      </header>

      <div className="about-body mt-4 text-sm leading-relaxed text-muted">
        <p className="text-base text-fg">
          The forest is a picture of a library. Each of its {BOOKS.length} public-domain books is one tree, and the
          shape of the tree is the shape of the book: the trunk is the work, the limbs are its sections, the leaves
          are its passages. A long book stands taller, and a book with more chapters carries more limbs.
        </p>

        <h3>A genre is a species</h3>
        <p>
          The books of a genre stand together in a grove, and each genre grows as a real tree, with its bark, leaf
          and growth habit. The groves ring the corpus redwood at the hub, one tree for the whole library with a limb
          reaching toward every book.
        </p>
        <ul className="about-species">
          {species.map(({ s, genres }) => (
            <li key={s.name}><span>{s.common}</span><em>{genres.join(", ")}</em></li>
          ))}
        </ul>

        <h3>The sky</h3>
        <p>
          The sky is real astronomy, placed for your time and place: the sun, the moon in its true phase, the 5,080
          stars of the Yale Bright Star Catalogue, the five naked-eye planets, and meteors at tonight's real rates,
          each shower in season falling from its radiant among the stars. Twilight washes out the faint stars first,
          and the moon hides whatever is behind it. Fog and cloud hide the lot. Choose Dawn, Day, Dusk or Night with
          the clock, or Live for your own sky right now.
        </p>

        {/* Mounted only while open, so each opening reads the sky for now. */}
        {open && <NightSky />}

        <h3 ref={keys}>Getting around</h3>
        <dl className="about-keys">
          {(COARSE_POINTER ? TOUCH : KEYS).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {!COARSE_POINTER && (
          <p className="text-faint">On a phone: the stick at bottom left drives, a drag anywhere else looks. A gamepad works too.</p>
        )}

        <h3>How it was made</h3>
        <p>
          The books come from Project Gutenberg, indexed by GutenbergKG. Each tree is grown in code, not drawn: its
          wood grows toward the passages it has to reach, and every limb is as thick as the wood it carries. The
          forest is built with three.js and React. The astronomy is SunCalc's; the stars are the Yale Bright Star
          Catalogue (Hoffleit &amp; Warren, 1991); the planets follow JPL's approximate Keplerian elements (Standish)
          with magnitudes from Mallama &amp; Hilton (2018); the moon is NASA's Lunar Reconnaissance Orbiter color
          mosaic. The <a href={USER_GUIDE_URL} target="_blank" rel="noopener" className="text-primary underline">user
          guide</a> covers the rest.
        </p>
      </div>
      </div>
    </dialog>
  );
}
