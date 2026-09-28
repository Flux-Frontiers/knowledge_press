# Release Notes -- v1.26.0

> Released: 2026-09-28

### Added

- **A brand folder, `assets/brand-system/`,** built around the press seal:
  the seal in full color and in one-color navy and cream, the name as a
  wordmark, horizontal and stacked lockups for light and dark grounds, the
  four colors in `colors.css`, and a README with the seal's construction,
  clear space, minimum sizes and misuse. TRADEMARK.md already claimed
  assets at that path; until now it did not exist here. The KP and the name
  are set in Merriweather Bold, committed under `fonts/` with its SIL Open
  Font License, and `build.py` traces them into every SVG in the folder and
  into the app icon sources and the favicon, so all of them share one KP.
- **`make icons`** re-renders every app icon PNG from the press-seal SVGs in
  `app/icon/`: the 1024 px master and its iOS and splash copies, the proof
  strip, and the ten macOS sizes. Its output is deterministic, so a run with
  unchanged SVGs leaves the tree clean. macOS only; it draws with AppKit.
- **Search the corpus by author.** The Browse tab's genre list has a search
  field. Results are grouped by author, list each book with the genre it is
  shelved under, and open into the book's chapters. Every word typed has to
  begin a word of the name, in any order, ignoring case and accents: "tolst"
  finds Tolstoy and "emile zola" finds Émile Zola. Works from the installed
  corpus and from the worker alike.
- **Simulator targets for App Store screenshots.** `make ios-sim` builds the
  app for a simulator, installs it with the corpus, sets a dark 9:41 status
  bar and launches it; `make ios-sim-screenshot` writes a screenshot at the
  exact size App Store Connect wants for that device. `SIM` names the
  simulator, `SIM_APPEARANCE` the appearance. `make ios-sim-kill` shuts every
  booted simulator down afterward; left running, each one is a full iOS
  userland that outlives Xcode and holds tens of GB.
- **`docs/APP_STORE_LISTING.md`** holds the store listing text: name,
  subtitle, promotional text, description, keywords, review notes and URLs.
- **The Mac app ships with the corpus.** `make mac-build` stages the exported
  packs into `app/macos/Corpus` and bundles them into the .app, as the iOS App
  Store build does, so the notarized app works on a Mac with no installed
  corpus. `make mac-stage-corpus` and `make mac-unstage-corpus` do the staging
  by hand; `make mac-verify` fails if the built app has no corpus. An installed
  corpus in Application Support still wins over the bundled one.
- **Mac App Store build.** `make mac-archive` makes a sandboxed Release
  archive with the corpus bundled, and `make mac-upload` exports it as a signed
  `.pkg` and sends it to App Store Connect, under the iOS app's record. The
  store build keeps Private Cloud Compute, which the Developer ID build cannot.
- **Staged corpora are gitignored.** Whatever `ios-stage-corpus` or
  `mac-stage-corpus` copies into `app/ios/Corpus` or `app/macos/Corpus` no
  longer shows up as 743 MB of untracked files; only the `.gitkeep` is tracked.
- **Ask again.** Every question in a chat has an **Ask again** button (and a
  context-menu item) that asks it once more, in the same corpus scope, with
  the answer engine and search settings as they are now.
- **The forest tour stops at every grove.** Riding the ring, the cart pulls
  up at each grove's stop, turns to face its signpost, holds there for five
  seconds, then turns back to the road and carries on. Any steering, braking
  or reversing still ends the tour.
- **Grove narration on the tour.** At each stop a caption summarizes the
  grove: how many books, its leading authors, its longest book, and for the
  diaries the years their entries span. It is generated from the catalog, so
  a new book changes it with nothing written by hand. A new setting, "Read
  each grove aloud on the ring" (off by default), speaks it with the
  browser's speech synthesis, which on Apple devices is the system's own
  voices; the cart waits at the sign until the sentence ends. Silent mode
  hides the caption and mutes the voice.

### Changed

- **A new icon: the press seal.** The graph mark with a Gutenberg "G" at its
  hub is gone. The app icon on iOS and macOS, the splash and About screens,
  and the web app's favicon now show a seal: a KP ligature for The Knowledge
  Press, the K's serifs landing on the P's stem, set in a ringed green disc
  like a printer's mark. The letters are Merriweather Bold, an openly
  licensed serif, traced to outlines, so the source SVGs in `app/icon/`
  render the same on any machine; the old live-text K, in Georgia, also ran
  past the green disc at its lower right.
- **The forest is a hub and spoke.** Groves stood on a golden-angle spiral at
  whatever distance they fitted, joined by roads routed around the trunks, so
  from above the roads wandered. Now the smaller groves stand outside a
  circular inner ring road and the larger ones outside an outer ring road,
  with six straight spokes from the redwood's plaza. The split between the
  tiers is whichever gives the smallest world: 284 m across instead of 301 m,
  with 1,720 m of road instead of 1,947 m. Home sits on a spoke, facing the
  redwood. The tour laps the inner ring first, then the outer, with its turns
  rounded.
- **The Mac app needs macOS 26**, the version its answer engines need and the
  store listing already states; it was 14.0.
- **The Mac dev build is sandboxed**, as the App Store build must be, so a
  sandbox failure shows up locally. `make mac-dev` now bundles the corpus,
  since its Application Support is the app's container. The notarized
  Developer ID build is unchanged: unsandboxed, sharing `swift run`'s corpus.
- **Settings: Delete all conversations.** The Settings row that deleted the
  open conversation now deletes every saved conversation and the chat on
  screen, after a confirmation. Deleting one conversation is still in the
  chat toolbar and in the sidebar's swipe and context menus.

### Fixed

- **The sacred texts' trees match the rebuilt corpus.** The web catalog is
  re-exported after a corpus rebuild: the Dhammapada, the Bhagavad Gita, the
  Bible, the Quran and the Upanishads each have one more chunk, and the Gita,
  the Bible and the Quran show new excerpts.
- **The web forest's README and FEATURES describe the forest as it is.**
  They still described a Fibonacci annulus with one ring road, listed the sky
  as next, and mapped 12 of the 43 source files. They now cover the
  hub-and-spoke layout, the tour's stops and narration, species, diary
  limbs, where the sky gets its location, the wind sculptures and the
  reader, and FEATURES moves the sky to Shipped and weather to Next.
- **The privacy page covers the web forest.** It described only the app.
  A new section says what the Knowledge Press Forest keeps in the browser,
  that it asks for the location to place the sky (rounded to 0.1 degree,
  kept in the browser), what reading aloud and reading books involve, and
  that GitHub Pages and Google Fonts see each visitor's IP address. Effective
  2026-09-28.
- **The forest credits the right authors.** The web catalog is regenerated
  from gutenberg_kg's corrected metadata: The Count of Monte Cristo is by
  Alexandre Dumas and Auguste Maquet rather than Maquet alone, The Federalist
  Papers by Hamilton, Jay and Madison, and names such as "Leo, graf Tolstoy"
  and "H. G. (Herbert George) Wells" read Leo Tolstoy and H. G. Wells. The
  Audel manuals show their author, Frank D. Graham, instead of "Unknown", and
  the five sacred texts, which name no author, are credited to "Various".
  The eight Audel trees are sized and excerpted from gutenberg_kg's cleaned
  OCR, which drops drawings read as text: 8 to 11 percent fewer chunks each,
  and most excerpts now open on prose instead of diagram debris.
- **The Browse reader shows clean text.** A chapter is assembled from
  overlapping chunks, so a sentence at every seam appeared twice ("It was an
  awful sight of money when it was piled up", twice, in Huckleberry Finn's
  first chapter); the overlap is now dropped by matching text. Prose kept
  the printed edition's hard line wrap and broke mid-sentence on a phone; it
  is now unwrapped, while verse and lists keep their lines. On the iPhone
  the chapter title no longer prints twice.
- **Retrieval in the simulator.** The query embedder ran on Core ML's GPU
  path, which the simulator lacks ("Espresso compiled without MPSGraph
  engine"), and its vectors matched nothing, so every search came back
  empty. The simulator now runs the embedder on the CPU; devices are
  unchanged.
- **The help page "What leaves this device" said conversations are not
  backed up.** They are part of the device backup on purpose (the corpus is
  excluded; conversations cannot be regenerated). The page now says so. The
  privacy and support pages on the web site also said answers are off by
  default; on-device is the default wherever Apple Intelligence is on.
- **The opening screen says what the seed questions are.** A line above
  them now explains that tapping one asks it, and that the tag is the part
  of the corpus it searches. Before, the list had no label.
- **iPad: the answer engine and corpus scope are back in Settings.** They
  were only in the sidebar, which portrait hides, so Settings on an iPad had
  no way to change them. The iPhone always had them; the iPad now matches.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
