# Features

Backlog for the web forest. Shipped items stay here so the PyVista mapping
doesn’t get lost. New work lands on `main` by pull request.

## Next

### Weather
Fog and random morning weather are done (see Shipped). What is left:

- **Clouds** drawn in the sky dome: noise on the view direction, drifting,
  lit from the sun's direction. The weather already carries a cloud cover
  value that dims the sun and stars; only the drawing is missing.
- **Rain and snow** (winter already drops the canopy; snow should actually
  fall), and wind that moves the leaves. Tied to season, overridable from the
  HUD like Spring/Summer.

### Press levels
A rank for how much of the forest you have pressed. Starting over shipped as
**Empty the press** (see Shipped).

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
- **Shown** as a chip beside the press count on the Browse button, with a
  progress bar to the next rank in the Press tab (L). Pressing the book that
  crosses a threshold shows a level-up toast in place of the usual "Pressed"
  one.
- **Tests** (`tests/levels.test.mjs`): each threshold and the ones either
  side of it; the top rank is exactly the catalog size.
- **Later, maybe:** weight by leaves pressed instead of books, so a long
  novel counts for more than a sonnet; show "3 of 12 pressed" on each grove's
  signpost plate.

## Later

| Feature | Notes |
| --- | --- |
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
| The cart carries the press: each book pressed rides in the bed in its grove's color, one draw call at any count, capped at 1.2 m so the seat camera stays clear | `cartLoad.ts`, `Cart.tsx`, `Player.tsx` |
| God's eye: wheel and pinch zoom toward the cursor, grove names, **Fly there** dives to a tree | `godEye.ts`, `ForestCanvas.tsx`, `GroveLabels.tsx`, `Player.tsx` |
| Look around with the arrows, or drag anywhere on the forest (mouse or one finger); the sideways look eases back to ahead | `input.ts`, `Player.tsx`, `TouchControls.tsx` |
| A genre mark on each stop plaza, the seal's construction with a glyph per genre; the glyph beside each genre in the list and atlas | `genreMarks.ts`, `GroveMarks.tsx`, `GenreGlyph.tsx` |
| Seasons (canopy density, palettes) | `seasons.ts` |
| Sky clock: sun, moon phase and stars for the live time and place, or dawn / day / dusk / night | `sky.ts`, `Environment.tsx`, `daylight.ts` |
| Planets: Mercury to Saturn where they are tonight, from JPL's approximate Keplerian elements, tested against Horizons | `planets.ts`, `Environment.tsx` |
| Real star field: the 5,080 naked-eye stars of the Yale Bright Star Catalogue, placed by precession, sidereal time and latitude | `starCatalog.ts`, `stars.ts`, `sky.ts`, `scripts/build-stars.mjs` |
| Meteors: sporadics and ten annual showers at real rates, from their radiants (`?meteors=` pins one) | `meteors.ts`, `MeteorSky.tsx`, `sky.ts` |
| Random weather: morning fog that builds and burns off, mist to pea soup, gray sky, dimmed sun and stars (setting, off by default; `?weather=` pins it) | `weather.ts`, `World.tsx`, `Environment.tsx`, `PauseOverlay.tsx` |
| Season and clock set themselves from the date and place each visit; **Use my location** for true sunrise and sunset | `seasons.ts`, `location.ts`, `ForestApp.tsx`, `NightSky.tsx` |
| Start screen over the live forest, the camera circling the redwood; **Exit** in the bar goes back to it | `StartScreen.tsx`, `ForestApp.tsx` |
| About (?): the species per genre, every control, and tonight's sky: moon phase, showers, planets up, Polaris | `About.tsx`, `NightSky.tsx` |
| Quests: First impressions, A Stoic and others, counted from the press and visited groves | `quests.ts`, `HUD.tsx` |
| Tour welcome, background, end-of-ring and farewell lines, editable as variables | `tourScript.ts`, `Player.tsx`, `HUD.tsx` |
| Night floodlights on the redwood and exhibits | `Uplights.tsx` |
| Moots: saved conversations between two books (`gutenkg export-web-moots`), played as speech bubbles in two voices matched to their authors, the speaking tree ringed in the forest | `moots.ts`, `MootOverlay.tsx`, `speech.ts`, `Trees.tsx` |
| Live moots: pick two books and a topic, and a local GutenbergKG worker writes each turn while you watch | `liveMoots.ts`, `MootOverlay.tsx`, `PauseOverlay.tsx` |
| Lantern query over titles, tags, excerpts | `HUD.tsx`, `Trees.tsx` |
| Browse panel (Groves, Books and Press tabs), minimap jump, home return, one-row phone bar with a three-dot menu | `HUD.tsx` |
| Jump to a tree from the press: **Tree** beside each entry lands at the tree with its card open, as the Books tab does | `HUD.tsx` |
| Empty the press (Press tab, after asking); Reset all settings leaves the press and visited groves alone | `HUD.tsx`, `store.ts` |
| Link to a tree: `?tree=<slug>` starts beside it with its card open | `deepLink.ts`, `ForestApp.tsx` |
| Corpus redwood at the hub, with its own ridged bark; book list popup (B), start at home | `corpusTree.ts`, `CorpusRedwood.tsx`, `HUD.tsx` |
| Exhibits on side spokes off the rings, spread round the forest: Kepler's Mysterium, three wind rotors, a DNA double helix, a weather mast | `exhibits.ts`, `Mysterium.tsx`, `WindSculptures.tsx`, `windRotors.ts` |
| Armillary sundial for 39° N: style on the celestial pole, hour ring square to it, the style's shadow computed from the sky's sun | `sundialGeometry.ts`, `Sundial.tsx` |
| Compass rose inlaid in the hub plaza round the redwood, north to the forest's north | `compassRoseArt.ts`, `CompassRose.tsx` |
| The Flame of Knowledge: George B. Suchanek's sculpture, scanned from his plaster model, in silver | `FlameOfKnowledge.tsx`, `public/models/` |
| Crown-aware tree placement: no branch passes through another tree | `forest.ts` |
| Silent mode; lantern trail clears on arrival | `preferences.ts`, `Player.tsx` |
| Carriage roads: two circular rings, up to six straight spokes, crossings rounded by 2 m curbs, a T where a spoke meets the outer ring | `forest.ts`, `roads.ts`, `World.tsx` |
| Guided tour (Q) along the roads by pure pursuit, lanterns lighting the road ahead, ending back at the redwood; steer to hop off | `tour.ts`, `Player.tsx`, `World.tsx` |
| Tour stops 5 s at each grove's signpost with a generated caption, read aloud if chosen | `tour.ts`, `narration.ts`, `speech.ts`, `HUD.tsx` |
| Named grove signposts with the grove's tree species; signs and plaques lit at night | `Signposts.tsx`, `species.ts` |
| Denser skeletons (raised attractor / node caps) | `growTree.ts` |
| Read a book from its tree, from static per-book JSON | `Reader.tsx`, `bookText.ts` |
| Press / local library | `store.ts` |
| Screenshots without the HUD | `screenshot.ts` |
| Tree portraits for the user guide's book gallery (`?shot=<slug>`) | `portrait.ts`, `scripts/gallery.mjs` |
| The forest grows in a web worker, so the page never freezes | `forestWorker.ts` |
