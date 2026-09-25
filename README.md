# The Knowledge Press

The apps that read a [GutenbergKG](https://github.com/Flux-Frontiers/gutenberg_kg)
corpus. GutenbergKG builds the library, a knowledge graph of public-domain books;
this repo holds the ways to read it.

| Directory | What it is | License |
| --- | --- | --- |
| [`app/`](app/) | The Knowledge Press for iPhone, iPad and Mac: searches the corpus on the device and answers with Apple Foundation Models. Swift, XcodeGen. | Proprietary, see [`app/LICENSE`](app/LICENSE) |
| [`app/fm-repro/`](app/fm-repro/) | A standalone reproducer for Apple. | Elastic-2.0 |
| [`web/`](web/) | Knowledge Press Forest: every book grown as a tree, a forest you drive through in the browser. Vite, React, Three. | Elastic-2.0 |

The names and artwork are covered by [`TRADEMARK.md`](TRADEMARK.md), not by
either license.

## Where the corpus comes from

Nothing here builds a corpus. The app searches the packs that
`gutenkg export-swift` writes, and the web forest's catalog is written by
`scripts/export_web_catalog.py`; both live in gutenberg_kg. The Makefile looks
for a gutenberg_kg checkout next to this one; point it elsewhere with
`GUTENBERG_KG_DIR=/path/to/gutenberg_kg`.

## Quick start

```bash
# App: compile for a device without signing (no phone needed)
make ios-check
make mac-check

# App on your devices, with the corpus exported in gutenberg_kg
make ios-push-all

# Web forest
make web-install
make web-dev
```

[`app/RUNBOOK.md`](app/RUNBOOK.md) is the full path from a built corpus to the
app answering on a phone with the network off.
[`web/README.md`](web/README.md) covers the forest's controls and layout.

## History

This code lived in gutenberg_kg until September 2026 and was split out with
its history intact. Its commit messages refer to gutenberg_kg pull requests by
number.
