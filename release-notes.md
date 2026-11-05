# Release Notes -- v1.33.0

> Released: 2026-11-04

### Added

- **The forest is inside the app.** A **Forest** tab on iPhone, and **The
  forest** in the iPad and Mac sidebar, runs the same forest as the web
  site, offline. The build ships inside the app and is served from the
  bundle through a private `kp-forest://` scheme, and a tree's reader gets
  its chapters from the app's corpus packs, so every installed book can be
  read with the network off.
- **Tree buttons.** Each Browse row and each citation card in an answer has
  a **Tree** button that opens the forest beside that book's tree with its
  card open. When the forest is already open it moves there without
  reloading.
- **Ask about this book.** In the app, a tree's card has a button that
  starts a new chat scoped to the book's genre, with `In <book>, ` already
  typed for you to finish.

### Changed

- **The corpus grows to 265 works: 261 books and four diaries.** The forest catalog is regenerated
  from gutenberg_kg's ten-book batch: Gogol's *The Mantle, and Other
  Stories*, the letters of Lady Mary Wortley Montagu and of Charles Lamb,
  Chekhov's *Plays, Second Series*, Synge's *The Playboy of the Western
  World*, Poe's Raven Edition volumes 2-5, and Cicero's *De Officiis*.
  The app's Swift packs are re-exported from the same bundle.
- **Docs state the current count.** The forest guide, the web README and
  FEATURES, and the runbook's export sample said 253 or 241 books; they
  now say 261 books and four diaries.
- **Archives stage the forest.** `make ios-archive`, `make mac-archive` and
  `make mac-dev` build the web forest from the same checkout and copy it
  into the app, as they already did for the corpus. They need Node 22 and
  `make web-install`. `ios-check` and `mac-check` still build without it,
  and the tab then says how to stage it.
- **The iPhone and iPad app is on the App Store.** The README, the docs
  home, the app guide and the App Store listing link it beside the Mac App
  Store page, and the listing keeps the 1.32.0 What's New text.

### Removed

- **No more synthesis traces.** Each on-device answer used to write a JSON
  file of the exact prompt and completion to `Application Support/Diagnostics`,
  kept for a Foundation Models bug report to Apple. Apple never answered, so
  the app stops writing them, and the Settings caption that pointed at them
  is gone.

### Fixed

- **Plays and prose read as printed in Browse and the forest.** A play's
  speaker names keep their own lines ("DUNCAN." no longer runs on from the
  speech before it), now that gutenberg_kg builds the packs with doc-kg
  0.30.0, which keeps each chunk's source line breaks. And the reader joins
  two chunks with the whitespace the source has between them, read from the
  pack's new `gap_after` column. It used to put a blank line at every seam,
  so a paragraph or a verse line broke in the middle ("And choke their art."
  / "The merciless Macdonwald" is one line of *Macbeth*). A pack without the
  column reads as before.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
