# Knowledge Press Forest

Web port of the GutenbergKG forest: 253 public-domain books grown as trees
(space colonization + pipe model + genre tropism), each genre a tree species,
laid out as a hub-and-spoke wheel of genre groves around a redwood for the
whole corpus. You drive a lantern cart through them.

This directory is additive — it does not replace the PyVista / Qt viewer.

See **[FEATURES.md](FEATURES.md)** for the backlog. Next: weather.


## Play it

The latest `main` build is live at
**https://flux-frontiers.github.io/knowledge_press/**, with the
[user guide](https://flux-frontiers.github.io/knowledge_press/docs/) beside it.

## Run it

From this folder:

```bash
npm install
npm run dev
```

Open the URL Vite prints. Click **Start driving**.

To read books in the forest (**Open the book** on a tree's card), run
`make web-books` from the repository root first. It writes each book's text to
`public/books/<slug>.json`, which the reader fetches; the published site gets
the same files at build time. Details are in
**[Reading books in the forest](../docs/BOOK_TEXT.md)**.

| Key | Action |
| --- | --- |
| **W / S** | throttle / reverse |
| **A / D** | steer left / right |
| **Left / Right** | look left / right; the view eases back ahead on release (gamepad: right stick) |
| **Up / Down** | tilt the camera up / down (gamepad: right stick) |
| **Space** | brake |
| **C** | camera: behind the cart, high view, in the cart, god's eye (the whole forest from above) |
| **E** | read the nearest tree into the press |
| **G** | grove atlas — jump to a genre or an exhibit |
| **B** | every book — filter the corpus and jump to any tree |
| **Q** | take the guided tour of the ring roads (steer to hop off) |
| **H** | return home, in front of the corpus redwood |
| **L** | open the press (collected books) |
| **Esc** | settings (camera, pace, look sensitivity, leaf detail, fog, narration, silent mode, geometry readout) |

With a book open: **Left / Right** turn the chapter, **Up / Down** scroll the page, **Esc** closes it.

Tap a grove's signpost, or its dot on the minimap, to list that grove's books;
jump to any one of them, or to the grove itself. The cart is **not** locked to rails
unless you take the tour. The groves stand on two circular brick ring roads,
the smaller groves outside the inner ring and the larger ones outside the
outer, and up to six straight spokes run from the redwood's plaza out through
both. A paved disc marks each place a spoke meets a ring.

**Q** takes the tour: the cart follows the road itself, out the nearest spoke,
round the inner ring, out along a spoke and round the outer ring, then back
in, slowing for the bends, while lanterns light the next 50 m of road. At each
grove it pulls up facing the signpost for 5 s and shows a short caption about
the grove: how many books it holds, by whom, and its longest. Turn on
**Read each grove aloud on the ring** in settings to hear the caption in the
system voice.
Steer, brake, or reverse to hop off.

The drive starts at home, facing the **corpus redwood** at the hub: one tree
for the whole library, 3.4 m tall per doubling of the corpus's chunks, with one
limb per book reaching toward that book's own tree. Its plaque and the **B**
list lead to every book. **Exhibits** stand in roadside glades: Kepler's
*Mysterium Cosmographicum* and three wind sculptures, each a real
vertical-axis rotor design. Gold diamonds on the minimap jump to them.

Diaries grow as diaries: one limb per calendar year, spiralling up the trunk,
with the entries hung along it by date.

Trees in a grove are placed as tight as their wood allows: each takes the
innermost spot where its trunk keeps 7.5 m and every branch keeps 0.6 m of air
from its neighbours, so crowns interleave but never pass through each other.

**Silent mode** (the bell, or Esc settings) stops cards popping up on their
own: nearby books, the redwood, quest hints. **E** still reads a tree.

On a phone, use the on-screen stick. Type a word in the lantern field to
light matching groves (`stoic`, `freedom`, `fire`, `sea`) — the lantern trail
points at the nearest hit. Switch season to **Winter** to drop the canopy and
read the wood.

**Time of day** has five modes; tap the clock in the HUD to step through them.
The default, **Live**, sets the sky from your own clock: the sun where it is
now for your time zone, the next sunrise or sunset, and the moon's current
phase. **Dawn**, **Day**, **Dusk** and **Night** hold the sky at that hour.
At night the stars and the lantern carry the scene. The choice is remembered
between visits, like the season.

The sky is placed for where you are: the browser's location if you allow it
(rounded to 0.1 degree and kept only in this browser), otherwise an estimate
from your time zone. At night lamps light the redwood and the exhibits from
their feet.

## Map to the PyVista stack

| gutenberg_kg | this package |
| --- | --- |
| `src/gutenberg_kg/treegeom.py` — space colonization, pipe model, tropism | [`src/game/growTree.ts`](src/game/growTree.ts) |
| `ForestLayout` — genre groves (here a hub-and-spoke wheel, not the Python annulus) | [`src/game/forest.ts`](src/game/forest.ts) |
| `kg_utils.viz3d.species`: tree habits, bark, leaf outlines | [`src/game/species.ts`](src/game/species.ts) |
| diary limbs, one per year (`treegeom`) | [`src/game/growTree.ts`](src/game/growTree.ts) |
| seasons / foliage | [`src/game/seasons.ts`](src/game/seasons.ts) |
| book corpus | [`src/game/catalog.ts`](src/game/catalog.ts) |
| `viz3d.py` Qt/PyVista viewer | [`src/game/ForestCanvas.tsx`](src/game/ForestCanvas.tsx) + [`Player.tsx`](src/game/Player.tsx) |
| retrieval as a query over the forest | lantern query in [`HUD.tsx`](src/game/HUD.tsx) |

The bundled catalog is a snapshot. Chunk counts are **not** produced in the
browser — they come from DocKG (`SELECT COUNT(*) FROM nodes WHERE kind='chunk'`
on each book's `graph.sqlite`). Hamlet's 420 is that count. To rebuild the
snapshot after ingest, run this in a gutenberg_kg checkout (it writes into a
sibling knowledge_press checkout; `--out` or `KNOWLEDGE_PRESS_DIR` moves it):

```bash
gutenkg export-web-catalog
```

Each grove draws as one textured bark mesh for its species and one instanced
leaf mesh, and groves lost in the fog are hidden, so 253 crowns stay
interactive. Attractors, nodes, and leaves are capped for the browser;
raise the caps in `growTree.ts` if you want denser Hamlet-scale skeletons.

## Layout of `src/game`

```
catalog.ts, catalogPart1-6.ts, catalogTypes.ts
               253 books: genre, chunks, excerpt, tags, corpus folder, diary periods
growTree.ts    space colonization + pipe-model radii + leaf points; diary year limbs
species.ts     genre -> tree species: habit, bark, leaf outline, foliage shift
forest.ts      hub-and-spoke grove layout (crown-aware placement), roads, tour loop, home
forestWorker.ts  grows the forest off the main thread
roads.ts       brick road ribbons and plazas
tour.ts        the guided tour: pure pursuit along the roads, a stop at each grove
narration.ts   each grove's tour caption, generated from the catalog
speech.ts      reads the caption aloud with the browser's speech synthesis
corpusTree.ts  the hub redwood: one limb per book, pipe-model trunk, needle sprays
exhibits.ts    roadside glades for set pieces
CorpusRedwood.tsx, Mysterium.tsx   the redwood and the Kepler exhibit
WindSculptures.tsx, windRotors.ts  the three wind sculptures
seasons.ts     canopy density + leaf / fog / ground palettes
sky.ts         sun and moon positions for a time and place (after SunCalc)
daylight.ts    daytime overrides on the season palette
Environment.tsx  sky, sun, moon, stars and the shadow-casting light
Uplights.tsx   night floodlighting for the redwood and the exhibits
sim.ts         cart pose, throttle, steer, trunk collision, teleport
input.ts       keyboard, gamepad and touch actions
Player.tsx     lantern cart + cameras (behind, high, in the cart, god's eye)
Trees.tsx      per-grove textured bark meshes + instanced species leaves
World.tsx      ground, roads, lantern trail, fog, plinth
Signposts.tsx  grove signposts and exhibit plaques
HUD.tsx        plaque, minimap jump, atlas, book list, lantern query, press, tour caption
Reader.tsx     a book's chapters, previous / next
bookText.ts    fetches books/<slug>.json, once per book
StartScreen.tsx, PauseOverlay.tsx, TouchControls.tsx   start, settings, on-screen controls
store.ts, preferences.ts   game state and saved settings (localStorage)
quests.ts, screenshot.ts   quest hints; screenshots without the HUD
```

To grow from the real corpus instead of the bundled catalog, replace
`catalog.ts` with JSON from the ingestion pipeline (id, title, author,
genre, chunk count, excerpt, tags). `forest.ts` already sizes a tree from
`chunks` and leans it with `GENRE_TROPISM`.

## Stack

Vite 8 · React 19 · Three 0.186 · R3F 9 · Zustand 5 · Tailwind 4

Excerpts are public-domain Gutenberg text. No accounts, and the forest itself
needs no server; book text is static JSON beside the page. The press saves
to `localStorage`.
