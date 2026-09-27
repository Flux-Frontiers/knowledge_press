# Release Notes -- v1.25.0

> Released: 2026-09-27

### Added

- **Knowledge Press Forest: read a book from its tree.** **Open the book** on
  a book card, and **Open** beside each book in the press, open a reader: a
  chapter picker, the chapter's text, and Previous / Next. A diary's chapters
  are its dated entries. The text comes from the GutenbergKG worker through a
  `/worker` proxy on the Vite dev and preview servers, so reading needs a
  local worker; the GitHub Pages build shows the excerpt and says so.
  `docs/LOCAL_WORKER.md` covers the setup, phones and iPads on the same
  network, and troubleshooting. Diaries need a worker built from gutenberg_kg
  after its diary-browsing fix.
- **Knowledge Press Forest: pick a tree.** Clicking or tapping a tree pins its
  card, even in silent mode; so does picking a book from search or the book
  list. The close button or a click on open ground clears it.
- **Knowledge Press Forest: look around.** The Left and Right arrows, and the
  gamepad's right stick, turn the view up to about 110 degrees either way and
  ease it back ahead on release. A and D still steer, so looking around no
  longer ends the guided tour.
- **Knowledge Press Forest: Environment settings.** A new group in settings
  holds the season and a fog density (Clear, Light, Normal, Heavy).
- **Knowledge Press Forest: reading feedback.** A book already in the press
  shows "In your press" in place of the read button, the touch Read button says
  "In press", and reading it again says it is already there.
- The forest's catalog carries each book's worker key (its corpus folder
  name), so the nine books whose title differs from the folder resolve too.

### Changed

- Book cards pop up only when the cart slows within reading range of a tree,
  and go away once out of range or past it. Driving at speed shows none.
- Roads keep 6.5 m from every trunk, outside reading range, instead of 2.75 m.
  The network is about 3% longer.
- The behind-the-cart camera sits 2.5 m up and looks level down the road.
- The Bible's catalog entry follows its 66-book rebuild.

### Fixed

- Grove signposts stand beside the road, toward their grove, instead of on the
  ring where the cart ran them over.
- On-device search gives a reciprocal-rank-fusion tie to the exact-phrase
  (BM25) hit instead of the dense one, matching gutenberg_kg's worker.
  "pillar of salt" now puts Genesis 19:26 ahead of Ruskin's "pillar of
  sand". Needs the `golden.json` from a gutenberg_kg `export-swift` run made
  after the matching change there.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
