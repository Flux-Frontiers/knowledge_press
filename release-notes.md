# Release Notes -- v1.41.0

> Released: 2026-11-11

The Forest gains a timeline that grows the library by date, draws much faster
on touch screens and from god's eye, and the app gains folding Settings, Reset
all settings, a larger icon seal, and fixes for exact-phrase answers and the
on-device window.

### Added

- **Timeline: grow the forest by date.** **Timeline** in the forest's menu
  opens a slider over every year a work appeared, 1000 BC to 1931, with play
  and pause and running totals of works, groves and chunks. Trees appear in
  their book's year, the corpus redwood grows from a sapling to full size, and
  the exhibits arrive in their own years (the armillary sundial about 255 BC,
  Kepler 1596, through the helical rotor 1995). The timeline opens in clean
  view and watches from the opening shot's circle round the redwood; drag or
  the arrow keys swing and tilt the camera. In god's eye it keeps the overhead
  view.
- **A literary year for every book.** The forest catalog gives each of the 265
  works the year it was first published, performed or composed, from
  gutenberg_kg's `corpus/pub_dates.tsv`.
- **The Landing Field**, a new exhibit: a raised pad in an open glade, kept for
  in-app events. The visitor event that uses it ships with no dates booked, so
  it does not appear.
- **Pan in god's eye** by dragging with the mouse or one finger; two fingers
  pan as they pinch.
- **R opens the book** of the tree whose card is showing, or the nearest tree.
- **Reset all settings**, at the bottom of Settings, restores search,
  synthesis and illustration defaults and clears the worker address. The
  corpus scope, the answer engine and your conversations are kept.

### Changed

- **The forest draws much faster on touch screens.** Far groves thin their
  leaves by distance, down to 15 percent, and the shadow pass thins with them:
  an iPad mini (A20 Pro) at Clear fog, Ultra and shadows on goes from 23 to 60
  fps. Touch screens start at High leaf detail. Macs and desktops draw every
  leaf near the ground.
- **God's eye draws fewer, larger leaves**, about 3M triangles at Ultra instead
  of 13M, after Solstice's Nanite-style foliage
  ([SamG-Coder/solstice](https://github.com/SamG-Coder/solstice), MIT). God's
  eye has no minimap and no drive stick, and its grove names are shorter and
  better placed.
- **On touch screens shadows are redrawn only when stale**, not every frame.
  On Macs they are drawn every frame and reach 120 m from the cart, so a
  grove's shadows no longer appear as the cart nears it. On every screen their
  edges keep still as the cart drives. Low-sun shadows at dawn and dusk are
  clearer.
- **The start screen draws at 30 fps**, halving its GPU load on an iPad mini.
- **Book trees differ more in height**: 6 m for the smallest book, 13.6 m at
  the median, 30 m for the largest.
- **Fly there lands behind the cart**, with the pressed books in view, and no
  longer flashes the book's title as it starts.
- **Press and Read on touch screens.** The touch Read button is called Press
  and reads the nearest tree into the press; beside a tree already pressed it
  says Read and opens the book. The card's button is Press the book.
- **Layout.** On an upright phone the search bar sits right of the drive stick.
  On iPad the forest fills the screen, with the top bar hidden while it shows.
- **Settings sections fold**, and the app remembers which are open. The list of
  chats is called **Conversations**, and **Delete all conversations** moved to
  its bottom. About links to the Knowledge Press guide.
- **A larger icon seal.** The press seal is scaled 1.25 times in the app icon,
  the splash and the web icons.
- Start driving and Guided tour wait for the forest's first frame instead of
  stalling on the press.

### Fixed

- **An exact phrase answers from the passage that holds it.** "pillar of salt"
  answered from Genesis and then reported that passages from Kings and the
  Quran did not mention it; the answer now uses the matching passages alone.
- **On-device answers use the window the model reports when you ask.** The
  budget was fixed when the engine was created, and before the model loaded
  the OS could report 4,096 tokens on a device whose window is 8,192.
- **The start screen shows the redwood's whole crown**, in the live view and
  in the stills shown while the forest loads.
- **The cart's lantern no longer blinds at night.**
- **Ride the ring from god's eye** dives to the cart first.
- **The iPad's Chat, Browse and Forest bar is one capsule**, without a second
  edge from iPadOS 26's glass.
- `make ios-build` and `make ios-sim-build` stage the forest first.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
