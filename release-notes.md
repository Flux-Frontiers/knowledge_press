# Release Notes -- v1.27.0

> Released: 2026-09-28

### Added

- `scripts/synth_replay.py` and `scripts/make_tokenizer_fixture.py`, moved
  here from gutenberg_kg because they serve the app.

### Changed

- The README opens with the Knowledge Press lockup and names
  `gutenkg export-web-catalog` instead of the retired script.
- **The forest reads books without a worker, including on GitHub Pages.**
  Each book's chapters are a static `books/<slug>.json`, written by
  `gutenkg export-web-books` from the Swift packs (`make web-books`). The
  files are not in git: `make web-books-publish` uploads them as a tarball on
  a draft `book-text` release, and the Web and Release workflows unpack it
  into the build, so the Pages site and the release zip can both read. The
  reader fetches a book once and pages through its chapters locally. The
  `/worker` proxy and `WORKER_URL` are gone, and `docs/LOCAL_WORKER.md` is
  now `docs/BOOK_TEXT.md`.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
