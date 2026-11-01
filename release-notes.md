# Release Notes -- v1.32.0

> Released: 2026-11-01

### Added

- **App: save an illustration.** A **Save Image** button under each
  rendered picture opens the share sheet: Save Image (Photos) and Save to
  Files on iPhone and iPad. The shared picture is titled with its question.
  On the Mac, **Save Image...** opens the Save panel, with **Share** beside
  it; the Mac app gains the user-selected-files sandbox entitlement.
- **App: re-render an illustration.** A **Re-render** button beside it,
  shown while the worker can draw, replaces the picture and its saved PNG.
- **App: export a chat as PDF.** The export button is now a menu with
  Markdown and PDF, shared as files so every share target is offered. On
  the Mac it also has Save as Markdown and Save as PDF through the Save
  panel. The PDF carries the same record as the Markdown file
  (question, provenance, answer, quoted passages) plus each turn's
  illustration, on US Letter in the US and A4 elsewhere. It is set in the
  house style: the brand lockup and app version at the head of page one,
  serif text with green accents, a running header, and numbered footers. The Markdown
  file notes each turn that has a picture and points to the PDF.
- **App: the unfolded iPhone Duo gets the sidebar layout.** The iOS app
  picks its layout by window width instead of device type: an unfolded Duo
  gets the iPad layout with the chat sidebar, its folded screen the phone
  layout, and an iPad in narrow Split View the phone layout too.
- **Forest: jump to a tree from the press.** Each entry in the Press tab
  has a **Tree** button in place of **Grove**: it puts the cart beside that
  book's tree with its card open, as the Books tab does. The Forest guide
  already described it this way.

### Changed

- **App: the rebuilt corpus, 255 books.** The apps ship packs exported on
  2026-11-01 from the rebuilt gutenberg_kg corpus, up from 253 books.
  Tolstoy's trilogy is now three books: Childhood, Boyhood and Youth. The
  embedder is unchanged, and the golden queries reproduce on device.
- **three.js r187.** `three` and `@types/three` move from 0.186 to 0.187.
  The forest stays on `WebGLRenderer`, so r187's new WebGPU drawing
  pipelines are not used.

- **App runbook: the Mac store build passes a clean install.** Installed
  from the Mac App Store on 2026-10-30, the shipped build found its bundled
  corpus. That closes the Mac item in the first-submission checklist, and
  the iPhone item now accepts a clean App Store install as well as
  TestFlight.
- **Forest: tap the redwood's sign to read it.** The sign at the corpus
  redwood opens at reading size, as an exhibit's plaque does. Tapping the
  tree, or B, still lists every book.
- **Forest: ? opens About at the key list.** The info button and the start
  screen still open About at the top.

### Fixed

- **Forest: the tour leaves a grove at a drive.** Started from a tree, the
  guided tour crawled toward the ring, held to the slow pace meant for
  drifting off the road, and then braked in the middle of the grove to
  face the grove's sign from ten meters off. It now drives to the ring at
  full tour speed, skips the stop for the grove it set out from, and pulls
  up at the next grove on the road. From 25 m out it reaches the ring in
  11 s, down from 23.

- **Forest: the cart fills from the front.** Pressed books stood first by the
  tailboard, where the tailboard hid them from the behind camera. Rows, flat
  stacks and the heap now start at the front board and fill back, so the
  first books are in view. A full cart looks the same as before.

- **Forest: a picked tree's card no longer hides the next tree's.** A card
  opened by clicking, searching or jumping stayed up until closed, so
  pulling up at another tree showed nothing new. Now, slowing at a
  different tree, away from the picked one, brings up that tree's card.
  A tree clicked while parked at another, or a jump that lands nearer a
  neighbor, keeps its card.

- **App Store link.** The README, the user guide's home and app Getting
  started pages, and the listing doc link to The Knowledge Press on the Mac
  App Store (Apple ID 6812116080). The iPhone and iPad app is in App Review.

### Removed

- **The notarized Developer ID Mac build.** `make mac-build`, `mac-verify`,
  `mac-notarize`, `mac-dmg`, `mac-notarize-dmg` and `mac-release` are gone.
  The Mac App Store is the only way the app reaches anyone else: the
  Developer ID build could not carry Private Cloud Compute, so it was a
  weaker app than the store build, and it was never published. The app
  runbook's section 7 now covers the signed dev build only.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
