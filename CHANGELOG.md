# Changelog

All notable changes to The Knowledge Press are documented here. Entries
before 1.23.0 are in the
[gutenberg_kg changelog](https://github.com/Flux-Frontiers/gutenberg_kg/blob/main/CHANGELOG.md),
where this code lived until September 2026.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- **`make icons`** re-renders every app icon PNG from the press-seal SVGs in
  `app/icon/`: the 1024 px master and its iOS and splash copies, the proof
  strip, and the ten macOS sizes. Its output is deterministic, so a run with
  unchanged SVGs leaves the tree clean. macOS only; it draws with AppKit.
- **Search the corpus by author.** The Browse tab's genre list has a search
  field. Results are grouped by author, list each book with the genre it is
  shelved under, and open into the book's chapters. Every word typed has to
  begin a word of the name, in any order, ignoring case and accents: "tolst"
  finds Tolstoy and "emile zola" finds Émile Zola. Works from the installed
  corpus and from the worker alike.
- **Simulator targets for App Store screenshots.** `make ios-sim` builds the
  app for a simulator, installs it with the corpus, sets a dark 9:41 status
  bar and launches it; `make ios-sim-screenshot` writes a screenshot at the
  exact size App Store Connect wants for that device. `SIM` names the
  simulator, `SIM_APPEARANCE` the appearance. `make ios-sim-kill` shuts every
  booted simulator down afterward; left running, each one is a full iOS
  userland that outlives Xcode and holds tens of GB.
- **`docs/APP_STORE_LISTING.md`** holds the store listing text: name,
  subtitle, promotional text, description, keywords, review notes and URLs.
- **The Mac app ships with the corpus.** `make mac-build` stages the exported
  packs into `app/macos/Corpus` and bundles them into the .app, as the iOS App
  Store build does, so the notarized app works on a Mac with no installed
  corpus. `make mac-stage-corpus` and `make mac-unstage-corpus` do the staging
  by hand; `make mac-verify` fails if the built app has no corpus. An installed
  corpus in Application Support still wins over the bundled one.
- **Mac App Store build.** `make mac-archive` makes a sandboxed Release
  archive with the corpus bundled, and `make mac-upload` exports it as a signed
  `.pkg` and sends it to App Store Connect, under the iOS app's record. The
  store build keeps Private Cloud Compute, which the Developer ID build cannot.
- **Staged corpora are gitignored.** Whatever `ios-stage-corpus` or
  `mac-stage-corpus` copies into `app/ios/Corpus` or `app/macos/Corpus` no
  longer shows up as 743 MB of untracked files; only the `.gitkeep` is tracked.
- **Ask again.** Every question in a chat has an **Ask again** button (and a
  context-menu item) that asks it once more, in the same corpus scope, with
  the answer engine and search settings as they are now.
- **The forest tour stops at every grove.** Riding the ring, the cart pulls
  up at each grove's stop, turns to face its signpost, holds there for five
  seconds, then turns back to the road and carries on. Any steering, braking
  or reversing still ends the tour.
- **Grove narration on the tour.** At each stop a caption summarizes the
  grove: how many books, its leading authors, its longest book, and for the
  diaries the years their entries span. It is generated from the catalog, so
  a new book changes it with nothing written by hand. A new setting, "Read
  each grove aloud on the ring" (off by default), speaks it with the
  browser's speech synthesis, which on Apple devices is the system's own
  voices; the cart waits at the sign until the sentence ends. Silent mode
  hides the caption and mutes the voice.

### Changed

- **A new icon: the press seal.** The graph mark with a Gutenberg "G" at its
  hub is gone. The app icon on iOS and macOS, the splash and About screens,
  and the web app's favicon now show a seal: a KP ligature for The Knowledge
  Press, the K's serifs landing on the P's stem, set in a ringed green disc
  like a printer's mark. The letters are Georgia Bold traced to outlines, so
  the source SVGs in `app/icon/` render the same on any machine; the old
  live-text K also ran past the green disc at its lower right.
- **The forest is a hub and spoke.** Groves stood on a golden-angle spiral at
  whatever distance they fitted, joined by roads routed around the trunks, so
  from above the roads wandered. Now the smaller groves stand outside a
  circular inner ring road and the larger ones outside an outer ring road,
  with six straight spokes from the redwood's plaza. The split between the
  tiers is whichever gives the smallest world: 284 m across instead of 301 m,
  with 1,720 m of road instead of 1,947 m. Home sits on a spoke, facing the
  redwood. The tour laps the inner ring first, then the outer, with its turns
  rounded.

- **The Mac app needs macOS 26**, the version its answer engines need and the
  store listing already states; it was 14.0.
- **The Mac dev build is sandboxed**, as the App Store build must be, so a
  sandbox failure shows up locally. `make mac-dev` now bundles the corpus,
  since its Application Support is the app's container. The notarized
  Developer ID build is unchanged: unsandboxed, sharing `swift run`'s corpus.

### Fixed

- **The forest credits the right authors.** The web catalog is regenerated
  from gutenberg_kg's corrected metadata: The Count of Monte Cristo is by
  Alexandre Dumas and Auguste Maquet rather than Maquet alone, The Federalist
  Papers by Hamilton, Jay and Madison, and names such as "Leo, graf Tolstoy"
  and "H. G. (Herbert George) Wells" read Leo Tolstoy and H. G. Wells. The
  Audel manuals show their author, Frank D. Graham, instead of "Unknown", and
  the five sacred texts, which name no author, are credited to "Various".
  The eight Audel trees are sized and excerpted from gutenberg_kg's cleaned
  OCR, which drops drawings read as text: 8 to 11 percent fewer chunks each,
  and most excerpts now open on prose instead of diagram debris.
- **The Browse reader shows clean text.** A chapter is assembled from
  overlapping chunks, so a sentence at every seam appeared twice ("It was an
  awful sight of money when it was piled up", twice, in Huckleberry Finn's
  first chapter); the overlap is now dropped by matching text. Prose kept
  the printed edition's hard line wrap and broke mid-sentence on a phone; it
  is now unwrapped, while verse and lists keep their lines. On the iPhone
  the chapter title no longer prints twice.
- **Retrieval in the simulator.** The query embedder ran on Core ML's GPU
  path, which the simulator lacks ("Espresso compiled without MPSGraph
  engine"), and its vectors matched nothing, so every search came back
  empty. The simulator now runs the embedder on the CPU; devices are
  unchanged.
- **The help page "What leaves this device" said conversations are not
  backed up.** They are part of the device backup on purpose (the corpus is
  excluded; conversations cannot be regenerated). The page now says so. The
  privacy and support pages on the web site also said answers are off by
  default; on-device is the default wherever Apple Intelligence is on.
- **The opening screen says what the seed questions are.** A line above
  them now explains that tapping one asks it, and that the tag is the part
  of the corpus it searches. Before, the list had no label.
- **iPad: the answer engine and corpus scope are back in Settings.** They
  were only in the sidebar, which portrait hides, so Settings on an iPad had
  no way to change them. The iPhone always had them; the iPad now matches.

### Changed

- **Settings: Delete all conversations.** The Settings row that deleted the
  open conversation now deletes every saved conversation and the chat on
  screen, after a confirmation. Deleting one conversation is still in the
  chat toolbar and in the sidebar's swipe and context menus.

## [1.25.0] - 2026-09-27

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

## [1.24.0] - 2026-09-26

### Added

- **Knowledge Press Forest: tree species that grow differently.** Each
  species carries a growth habit: a crown envelope (dome, ellipsoid, cone,
  ovoid, vase, umbrella, spindle), clear bole, central leader, and its own
  space-colonization parameters (tropism, influence radius, internode step,
  jitter, pipe-model exponent), plus a post-growth gravity droop that bends
  thin wood and carries each chunk with its twig. The book still sets the
  height, the sections and one crown point per chunk; the habit only sets
  where they sit and how the wood reaches them. Oak, chestnut, fir, plane and
  blackthorn no longer share one silhouette, and four species join them --
  stone pine (ancient-classical, sacred-texts), silver birch
  (russian-literature, letters, diaries), weeping willow (shakespeare, drama)
  and Lombardy poplar (travel, audel-electric) -- with CC0 ambientCG bark.
  Each book nudges its species' habit a few percent, so no two trees in a
  grove are clones. `web/species-preview.html` (dev only) grows the same books
  as every species side by side.
- **Knowledge Press Forest: screenshot button.** A camera button beside the
  clean-view eye saves the 3-D view as a PNG, without the HUD. Desktop
  browsers download it; phones and tablets open the share sheet, where Save
  Image puts it in Photos.
- **Knowledge Press Forest on GitHub Pages.** The Web workflow publishes
  `web/dist` to https://flux-frontiers.github.io/knowledge_press/ on every
  push to `main` that touches `web/`, and on a manual run from `main`.
- **Knowledge Press Forest: three wind sculptures.** Each is a vertical-axis
  rotor of a real design, on its own roadside plaza with a reading plaque:
  Gorlov's helical rotor (three stainless blades, each twisted half a turn),
  a Darrieus eggbeater (three white blades bowed in a sine arch), and a
  Savonius tower (six copper S-rotor tiers, staggered, alternate tiers
  mirrored and turning the other way). They spin with the "Wind & gentle cart
  motion" setting, faster in the same gusts that move the leaves, and carry a
  red obstruction light that blinks at night. They appear in the exhibit list
  and on the minimap like the Mysterium. The Mysterium's plaque became a
  shared `ExhibitPlaque`.
- **Knowledge Press Forest: read an exhibit's plaque full size.** Click or tap
  a plaque to open its text in a panel styled like the plaque itself; Escape,
  the close button or a click outside closes it, and the cart stays parked
  while it is open.
- **Knowledge Press Forest: the sky keeps time.** The sun and moon stand
  where they really are for the device clock, the date and the place
  (`sky.ts`, after SunCalc): the sun crosses the sky, rises and sets with a
  warm glow, and lights the forest from where it stands, with long shadows at
  either end of the day. At night the moon casts the light, brighter as it
  fills, and is drawn with its real phase: the disc is lit from the sun's
  direction, so the terminator falls where it does in the sky. Stars fade in
  through twilight. The time button now cycles Live, Day (today's solar noon)
  and Night (the darkest part of tonight, with the moon up if it rises); its
  tooltip gives the next sunrise or sunset and the moon's phase, and the status
  line shows the time. The place comes from the browser's location, asked once
  when play starts and kept rounded to 0.1 degree in this browser only; without
  it (refused, or a plain-http address such as the LAN dev server) the sky uses
  latitude 40 N and the time zone's longitude. Saves keep a night setting.
  Only a sun more than a few degrees up casts shadows: a low sun or the moon
  drove the shadow camera through far more forest, and skipping that pass
  makes nights and sunsets about 50% faster than before the clock.
  The moon's face is NASA SVS's LRO colour map (`textures/moon/`), mapped onto
  the near side and lit by the same terminator, so every phase shows the real
  maria, with a faint earthshine on the dark side.
  `docs/images/moon_phases.png` shows all eight phases as the shader draws
  them; `scripts/render_moon_phases.py` regenerates it.
- **Knowledge Press Forest: click the corpus redwood, or its plaque, to browse
  every book.**
- **Knowledge Press Forest: floodlights at night.** The corpus redwood and the
  wind sculptures are lit from lamps at their foot as the sky darkens: each
  glows in its own colour, strongest at the ground and fading with height,
  with the lamps and a pool of light on the paving (`Uplights.tsx`). It is
  faked in the materials rather than done with real lights, which three.js
  would shade on every pixel of the forest; the night frame rate is unchanged.
- **`make web-kill`** stops every running Vite dev or preview server,
  matched by command line rather than port.
- **Knowledge Press Forest: season in Settings.** The season picker was only
  on the start screen and in the season buttons, which phones hide; Settings
  now has it too.
- **Knowledge Press Forest: clean view.** A button at the top right hides the
  other buttons, the title card, the search box and the pop-up cards, leaving
  the map and the driving controls. The same button brings them back.

### Removed

- **Knowledge Press Forest: the "The Press" signpost** on the hub plaza.

### Changed

- **Mac app: the Developer ID build answers on-device only.** Apple's
  Developer ID profile does not grant Private Cloud Compute, so `make
  mac-build` signs without the entitlements file. Every other build keeps
  Private Cloud Compute.
- **Knowledge Press Forest: clearer day sky.** Daytime fog is about half as
  dense (0.28 of the night density, was 0.5) and blue, the sky's horizon is
  blue instead of grey-green, and the zenith blue is deeper and reaches
  further down the dome. The day colours are chosen for what ACES tone
  mapping shows: the old pale horizon came out near grey. Night and
  autumn's warm horizon are unchanged.
- **Knowledge Press Forest: dawn and dusk.** The time button cycles live,
  dawn, day, dusk and night. Dawn and dusk pin the sky to today's sun 4°
  above the horizon, rising or setting, near the peak of the glow.
- **Knowledge Press Forest: home is closer to the redwood.** The drive
  starts, and H returns, 11.5 m from the hub instead of 15 m. From 15 m the
  chase camera sat beside the Ancient & Classical signpost, which filled the
  opening view.
- **Knowledge Press Forest: stronger wind in the leaves.** Crowns sway
  together, more the higher the leaf, in waves across each grove, and every
  leaf flaps about its stalk at about 1 Hz. The wind is applied in world space
  now; before, each leaf only drifted about its own width, too little to see
  beyond a few metres. It follows the same gusts as the wind sculptures and
  moves the leaf shadows with it.
- **Knowledge Press Forest: the "In the cart" camera is at eye level.** It sits
  at a standing adult's 1.65 m (was 1.3 m), gazes level instead of slightly
  down, and uses a 60 degree field of view (was 72), so the horizon, plaques
  and plinths sit where they would on foot and tall pieces are not stretched
  at the frame's edges. Tilt up to take in a sculpture or the redwood.
- **Knowledge Press Forest: the "Behind the cart" camera is closer.** It
  follows 6.5 m back and 3.5 m up (was 8.4 m and 4.5 m).

### Fixed

- **Knowledge Press Forest: blackthorn and fir limbs no longer wander.** Two
  species reached too short a way for their growth to steer: the blackthorn's
  limbs coiled into helices and the fir grew a branch back down to its lowest
  whorl. Blackthorn influence 6 -> 10 and jitter 0.3 -> 0.18, fir influence
  7 -> 12, mirroring `kgmodule-utils` 0.25.1's `SPECIES`.
- **Knowledge Press Forest: forest build could hang.** A tree whose crown fit
  nowhere on a grove's candidate spiral was left unplaced, the grove's radius
  became NaN, and packing the groves round the hub looped forever. The spiral
  now extends until every tree fits, and packing rejects a non-finite radius.
  Hot hash grids use integer keys, so the build stays at ~11 s.
- **Knowledge Press Forest: the ring road could cut across the hub** between
  two near grove stops on opposite sides. The ring's stop order now counts
  such a leg as the drive around the hub, and ring legs are routed round a
  keep-out disc at the centre.
- **Knowledge Press Forest: no more road hairpins.** Road routing
  string-pulls each route until it is taut, resampling and pulling from the
  far end too. One forward pull kept the corners of any road A* had hugged,
  so the ring swung in to the hub's north spoke and doubled back 107° to the
  Ancient & Classical stop. The sharpest turn away from a stop is now 35°,
  the network is 49 m shorter, and three exhibits, placed along the roads,
  stand in new spots.
- **Knowledge Press Forest: grove signposts.** The sign stands on a post at
  each end instead of one centre post, which came out through the back of
  the board, over the text as read from behind.
- **Knowledge Press Forest: plaque posts no longer show through the text.**
  The lectern posts rose to 1.6 m, past the tilted board's centre, and came
  out through its face at either end; they now stop at 1.3 m, behind it.
- **Knowledge Press Forest: opening Settings no longer selects the pace
  menu.** The dialog focused its first control, which phones showed as
  picked; it now focuses "Back to the forest".
- **Knowledge Press Forest: roads, plazas and bark are no longer black in
  Safari.** WebKit (Safari, and every browser on iOS) renders a texture black
  when anisotropic filtering is on, which every brick and bark texture set.
  Anisotropy is now off in WebKit only (`textureAnisotropy` in
  `Environment.tsx`); other browsers keep it for sharp roads at grazing angles.

## [1.23.0] - 2026-09-25

The first release from this repository. The iOS/macOS app and Knowledge Press
Forest moved here from gutenberg_kg with their history; gutenberg_kg still
builds and exports the corpus.

### Added

- **Knowledge Press Forest: truthful trees, textured and driveable on a phone.**
  Tree growth now mirrors the Python viz3d (`kg_utils.viz3d.organic.colonize`,
  `grow_tree_geometry`): every chunk is a crown point, growth reaches for up to
  3000 of them with no node cap, and at the Ultra leaf level every one of the
  corpus's 398,214 chunks is a leaf. Lower levels show the same fraction of every
  book (1 in 10, 4, 2), so crowns stay proportional. Genres grow as five species
  with CC0 ambientCG bark and species leaf outlines on continuous swept bark
  meshes; roads are herringbone brick; each grove stands on its own tinted ground.
  One render chunk per grove lets the renderer skip groves out of view or lost in
  the fog, and the forest grows in a Web Worker. Measured: 60 fps at Ultra on a
  laptop and an iPhone 17 Pro, 50-60 on an iPad. Also: brake, turn-in-place and a
  settings dialog; search with a results list, jump-to-tree and minimap pins; an
  in-the-cart camera; Up/Down (or a touch look strip) to tilt the view; touch
  layouts for phones and tablets; an optional triangles / draw-calls / fps readout.
- **Knowledge Press Forest: a compact, drivable world with a hub monument.** Trees
  sit on an even grid about 9 m apart and groves pack around the hub (world radius
  418 m to 210 m). Roads are routed around the trunks on a clearance map, so every
  road keeps the cart clear of every tree. Trunks now rise plumb instead of all
  leaning one way. The hub holds Kepler's *Mysterium Cosmographicum* (the five
  Platonic solids nested between planetary shells, at Kepler's ratios) with a reading
  plaque, and a Home button returns to it. Also: slower driving, larger signposts,
  textured rocks and bladed grass, gusty wind, and leaves on visible stalks.
- **`make ios-push-all`: app and corpus to every device in one step.** It builds
  once, then on each reachable device installs the app, copies the corpus and
  relaunches. `ios-deploy-all` still installs only the app. If a device drops
  off mid-copy, the target records it, moves on to the next device, and exits
  non-zero at the end with the list of devices to retry.
- **Releases.** Pushing a `v*` tag runs `.github/workflows/release.yml`, which
  checks that every version site matches the tag (`scripts/check_version.py`),
  builds the web forest, and publishes a GitHub Release with the build attached
  as `knowledge-press-forest-vX.Y.Z.zip`.
- **CI and pre-commit.** `.github/workflows/ci.yml` runs the pre-commit hooks
  on every push and pull request to `main`: file hygiene, ruff, detect-secrets
  and the version check. Locally the hooks also run the web typecheck and
  tests when `web/` changes. The Swift package and Xcode builds stay in
  `app.yml`.
- **`CITATION.cff`** and a citation section in the README.

### Changed

- **The iOS and macOS apps carry a real version.** They had stayed at `1.0 (1)`.
  `MARKETING_VERSION` in both `project.yml` files is now 1.23.0, the Info.plist
  reads it and the build number from build settings instead of literals, and
  every `xcodebuild` in the Makefile sets the build number to the git commit
  count plus `APP_BUILD_OFFSET`, so each App Store Connect upload outranks the
  last. The web app's `package.json` carries the same version.
- **The corpus comes from a sibling gutenberg_kg checkout.** The Makefile finds
  it through `GUTENBERG_KG_DIR` (default `../gutenberg_kg`).
