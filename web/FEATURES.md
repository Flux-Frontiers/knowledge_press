# Features

Backlog for the web forest. Shipped items stay here so the PyVista mapping
doesn’t get lost. New work lands on `main` by pull request.

## Next

### Weather
The sky is done (see Shipped); weather is the next world pass.

- **Weather** as a first-class layer: clear, high haze, rain, snow (winter
  already drops the canopy — snow should actually fall), and wind that moves
  the leaves. Tied to season, overridable from the HUD like Spring/Summer.

### Press levels
A rank for how much of the forest you have pressed, and a way to start over.

- **Ranks** from the printing trade, by books pressed:

  | Rank | Books pressed |
  | --- | --- |
  | Reader | 0 |
  | Printer's Devil | 1 |
  | Apprentice | 5 |
  | Compositor | 12 |
  | Journeyman | 25 |
  | Pressman | 50 |
  | Master Printer | 100 |
  | Keeper of the Press | every book in the catalog |

- **Derived, not stored.** `levelFor(library)` in a new `levels.ts` computes
  the rank from `store.library`, so there is nothing new to save and no way
  for a saved rank to drift from the books behind it.
- **Shown** as a chip beside the press count in the HUD, with a progress bar
  to the next rank in the press panel (L). Pressing the book that crosses a
  threshold shows a level-up toast in place of the usual "Pressed" one.
- **Reset the press** from the press panel: a button, then a confirm step
  that says what will go. It empties `library` and `grovesVisited`, which
  also clears the quests, and keeps the season, clock, place and
  preferences. A new `resetPress()` store action does it and persists.
- **Tests** (`tests/levels.test.mjs`): each threshold and the ones either
  side of it; the top rank is exactly the catalog size; `resetPress` empties
  the library and visited groves, keeps the preferences, and writes the save.
- **Later, maybe:** weight by leaves pressed instead of books, so a long
  novel counts for more than a sonnet; show "3 of 12 pressed" on each grove's
  signpost plate.

## Later

| Feature | Notes |
| --- | --- |
| God's-eye zoom and a visible flight to a tree | The god's-eye camera shows the whole forest at one fixed height. Zoom in and out, and fly visibly to a picked tree. |
| Jump to a tree from the press | The press list opens a book or jumps to its grove; the lantern query and the **B** list already land at the tree. |
| Ambient audio | Wind, wet leaves, a distant press. Unlock on first gesture. |
| Breadcrumb lanterns | Optional trail of your own lights so a long wander still has a way home. |
| Live corpus ingest | `gutenkg export-web-catalog`, in gutenberg_kg, counts `kind='chunk'` nodes in each book's `graph.sqlite` and rewrites the TypeScript catalog. The web forest does not re-chunk. |

## Shipped

| Feature | Where |
| --- | --- |
| Space-colonization trees, pipe-model radii, genre tropism | `growTree.ts` |
| Nine tree species by genre: habit, textured bark, leaf outlines | `species.ts`, `Trees.tsx` |
| Diaries as year limbs spiralling up the trunk, entries along them by date | `growTree.ts` |
| Hub-and-spoke groves on two ring roads, 253-book catalog | `forest.ts`, `catalog.ts` |
| WASD lantern cart; cameras behind, high, in the cart and god's eye (C) | `Player.tsx`, `sim.ts` |
| Look around with arrows or the right stick; touch stick and look strip | `input.ts`, `TouchControls.tsx` |
| Seasons (canopy density, palettes) | `seasons.ts` |
| Sky clock: sun, moon phase and stars for the live time and place, or dawn / day / dusk / night | `sky.ts`, `Environment.tsx`, `daylight.ts` |
| Night floodlights on the redwood and exhibits | `Uplights.tsx` |
| Lantern query over titles, tags, excerpts | `HUD.tsx`, `Trees.tsx` |
| Grove atlas, minimap jump, home return | `HUD.tsx` |
| Corpus redwood at the hub, book list popup (B), start at home | `corpusTree.ts`, `CorpusRedwood.tsx`, `HUD.tsx` |
| Exhibits in roadside glades: Kepler's Mysterium, three wind sculptures | `exhibits.ts`, `Mysterium.tsx`, `WindSculptures.tsx` |
| Crown-aware tree placement: no branch passes through another tree | `forest.ts` |
| Silent mode; lantern trail clears on arrival | `preferences.ts`, `Player.tsx` |
| Carriage roads: two circular rings, up to six straight spokes, plazas where they meet | `forest.ts`, `roads.ts`, `World.tsx` |
| Guided tour (Q) along the roads by pure pursuit, lanterns lighting the road ahead; steer to hop off | `tour.ts`, `Player.tsx`, `World.tsx` |
| Tour stops 5 s at each grove's signpost with a generated caption, read aloud if chosen | `tour.ts`, `narration.ts`, `speech.ts`, `HUD.tsx` |
| Named grove signposts | `Signposts.tsx` |
| Denser skeletons (raised attractor / node caps) | `growTree.ts` |
| Read a book from its tree, from static per-book JSON | `Reader.tsx`, `bookText.ts` |
| Press / local library | `store.ts` |
| Screenshots without the HUD | `screenshot.ts` |
