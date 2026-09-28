# Reading books in the forest

**Open the book** on a tree's card shows the book's text. The forest reads it
from a static file, `books/<slug>.json`, one per book, served next to the page.
No worker or other backend is involved, so reading works on GitHub Pages, from
`npm run dev` and `npm run preview`, and from a release zip on any static host.

The files are not in git. They total about 175 MB (63 MB as a tarball) and are
generated from the corpus in `gutenberg_kg`.

## Where the text comes from

`gutenkg export-web-books` in `gutenberg_kg` reads the Swift packs that
`gutenkg export-swift` writes, the same packs the app reads, and writes each
book's chapters as `web/public/books/<slug>.json`:

```json
{"chapters": [{"title": "SCENE I. Elsinore. A platform before the Castle.", "text": "..."}]}
```

Chapters are rebuilt the way the worker's `get_chapter` rebuilds them: a book's
text between one section and the next, a verse-chunked book by its chapter
numbers, and a diary by dated entry. `<slug>` is the catalog's `slug`, so every
tree finds its text. Oversized sections come out as "(Part 1 of 4)" and so on,
as the app's Browse tab shows them.

## Reading locally

With `gutenberg_kg` checked out next to this repository (or `GUTENBERG_KG_DIR`
pointing at it) and its packs exported:

```bash
make web-books     # writes web/public/books/
make web-dev       # or make web-preview
```

Open the URL Vite prints, normally `http://localhost:5173`, and click
**Start driving**. `npm run dev` also listens on your network address, so a
phone or iPad on the same network can open `http://<your-mac>.local:5173`.

## Publishing the text

The Pages build and the release zip download the text as `books.tar.gz` from a
draft GitHub Release tagged `book-text`, and unpack it into
`web/public/books` before `npm run build`. After the corpus changes:

```bash
make web-books
make web-books-publish
```

`web-books-publish` creates the draft release on first use, replaces its
tarball, and starts the Web workflow on `main` so Pages redeploys.

Keep the release a draft. Zenodo archives every published GitHub Release,
prereleases included, and ignores only drafts. A draft is invisible to a
read-only token, so the workflows that download it run with
`contents: write`.

## Open a book

1. Drive up to a tree and slow down until its card appears, or click the tree
   to pin its card.
2. Click **Open the book**. Books you have read into the press also have an
   **Open** link in the press (**L**).
3. Pick a chapter from the list, or use **Previous** and **Next**. A diary's
   chapters are its dated entries.
4. Press **Esc** or the close button to return to the forest. Driving and the
   keyboard shortcuts pause while a book is open.

On an iPad with a keyboard, if the Left and Right arrows don't look around and
a blue box appears when you press them, turn off **Full Keyboard Access** in
**Settings > Accessibility > Keyboards & Typing** (on some versions,
**Keyboards**). It takes the arrow keys for itself.

## Troubleshooting

**The reader says the text was not found.**
The book's file is missing. Locally, run `make web-books`. On Pages, check that
the Web workflow's "Fetch the book text" step found the `book-text` release.

**A book opens with the wrong chapters.**
The files are older than the packs. Run `make export-swift` in `gutenberg_kg`,
then `make web-books`, and `make web-books-publish` for the published site.

**Port 5173 is already in use.**
Vite moves to the next free port and prints it. `make web-kill` stops every
running Vite server.
