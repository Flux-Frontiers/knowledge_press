# Release Notes -- v1.34.0

> Released: 2026-11-05

### Added

- **Search Browse by title.** The Corpus list's search field, which found
  authors, now finds titles too: "raven" finds *The Raven and Other Poems*
  and "divine" both Divine Comedies. Matching authors come first; a
  **Titles** section follows with the other books whose title matches, by
  the same rule (each word typed begins a word of the title, ignoring case
  and accents).
- **Captioned App Store screenshots.** `make store-shots` sets each raw
  capture under its caption on the press's navy ground, at the exact store
  size for iPhone, iPad and Mac, opaque, with a contact sheet per device,
  and fails on a wrong size, an alpha channel or a missing caption.
  `docs/APP_STORE_LISTING.md` gains the nine-shot list for the Forest
  release, the promotional text and description section that go live with
  it, and the featuring nomination.

### Changed

- **Branded The Knowledge Press: The Forest.** With the Family and the
  Disulfides beside it, this edition names itself: the web forest's page
  title and start screen, the docs site, the README, and in the app the
  chat header, splash, About, sidebar and Mac window title. The Settings
  header, which still said GutenbergKG from the app's first build, says the
  same. The app's name
  on the home screen and in the stores stays The Knowledge Press.

- **Ask about this book asks that book.** The forest card's button used to
  scope the new chat to the book's genre, so the scope picker showed the
  genre and the answer could cite other books in it. It now scopes the chat
  to the book itself (`<genre>/<book>`, the key the worker already takes),
  the picker shows the book, and on-device retrieval searches only that
  book's passages, or a diary's.

- **The start screen's eyebrow says Flux Frontiers.** It read
  "GutenbergKG · Flux Frontiers", the last place the forest's own branding
  still named the indexer. About and the moot settings keep GutenbergKG
  where they mean the software.

### Fixed

- **The forest no longer stays zoomed and cropped on iPhone.** Tapping the
  forest's query field made iOS zoom the page in, since the field's text is
  under 16 px, and the app's web view cannot scroll, so the forest stayed
  cut off on both sides until it was reopened. The page's viewport now sets
  `maximum-scale=1`, which stops that zoom; Safari still lets a reader
  pinch-zoom the web forest.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
