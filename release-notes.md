# Release Notes -- v1.29.0

> Released: 2026-10-05

### Added

- **Meteors and the major meteor showers.** The night sky shows sporadic
  meteors and, in season, the ten major annual showers, from Quadrantids to
  Ursids, at the rates a dark sky would show: each shower's rate follows
  its activity profile around the peak and the height of its radiant, and
  its meteors fan out from the radiant's true place among the stars. Fast
  meteors are brief and greenish, slow ones linger and run yellow. They
  dim with twilight, fog and cloud as the stars do. `?meteors=perseids`
  pins a shower to its peak and `?meteors=perseids:20` multiplies its rate.
- **God's eye zooms, and flies down to a tree.** The mouse wheel or a
  two-finger pinch zooms toward the point under the cursor or between the
  fingers, from the whole forest down to about one grove. Grove names float
  over each grove in this view only. A tree's card gains **Fly there**: the
  cart is set down at the tree and the camera dives from overhead to the
  camera you were using before god's eye, in about two and a half seconds.
- **An armillary sundial**, an eighth exhibit: a brass equatorial ring dial
  built for 39° N. Its rod points at the celestial pole (true north, 39° up),
  the hour ring stands square to it with IV to VIII engraved inside, and a
  horizon ring carries the compass points. The rod's shadow on the ring is
  computed from the sky's own sun, so it reads local solar time through the
  day and thins away at the equinoxes as a real ring dial's does. It is drawn
  only with the sun up and fades under fog and cloud.
- **A compass rose** inlaid in the hub plaza around the corpus redwood:
  sixteen points radiating from the trunk, a degree bezel, north in red. Its
  north is the forest's north.
- **An app guide** for the iPhone, iPad and Mac app, beside the forest guide:
  getting started on each device, asking a question and choosing a scope,
  reading an answer and its sources, the answer engines, Browse, chats and
  export, every setting, what leaves the device, and troubleshooting. It
  replaces "Inside the app" as the app section's front door; that page and
  the store listing move to a Reference tab.
- **A book gallery** in the user guide: sixteen trees, from Pepys's diary to
  *A Modest Proposal*, each photographed alone from the same distance with
  the cart beside it for scale, with what to notice and a link into the
  forest beside it. `web/scripts/gallery.mjs` (`make docs-gallery`) renders
  the pictures from the forest's `?shot=<slug>` mode.
- **Link to a tree.** `?tree=<slug>`, for example `?tree=hamlet`, starts the
  drive beside that book's tree with its card open and the lantern trail
  pointing at it. The start screen names the tree. An unknown slug is
  ignored.
- **A user guide for the forest**, built from `docs/` with mkdocs-material
  and published beside the forest at
  [knowledge_press/docs](https://flux-frontiers.github.io/knowledge_press/docs/):
  getting started and the controls, what the trees and groves mean, driving
  and the tour, reading and the press, finding books, the sky and weather,
  every setting, and troubleshooting. The start screen and the settings link
  to it. `make docs` builds it locally; the Web workflow builds it with
  `--strict`, so a broken link fails the build.
- **A look stick on touch.** The right-hand strip that only tilted is now a
  full round stick like the drive stick: up and down tilt and hold, left and
  right look around and ease back to ahead on release, as the arrow keys do.
- **Genre marks.** A round mark on the paved stop ahead of each grove, on
  the press seal's construction: the grove's color in the band, the cream
  rule, and a glyph for the genre in the ink disc, its top toward the grove.
  Twenty glyphs, a sternwheeler for American literature to Yorick for
  Shakespeare. The same glyph stands beside each genre in the book list and
  the atlas, in place of the colored dot.
- **The species under each genre in the book list**, common and Latin
  names, so the list says what the trees are.
- **Arrow keys in the reader.** Left and Right turn to the previous or next
  chapter; Up and Down scroll the page.
- **Reset all settings** (Pause, at the bottom). Puts the preferences, season
  and clock back as on a first visit, clears the books you have pressed, and
  forgets the ring tour's welcome, so the next tour gives it in full again.
  It asks first. The groves visited are kept.
- **A real night sky in the web forest.** The 750 random points are replaced
  by the 5,080 stars of magnitude 6 or brighter in the Yale Bright Star
  Catalogue. One matrix (precession, sidereal time, latitude) puts them where
  they stand for the sky's clock and place, the same math that places the sun
  and moon. Size follows magnitude and color follows B-V, and stars fade
  toward the horizon. `web/scripts/build-stars.mjs` regenerates the catalog
  from VizieR.
- **Random weather** (Settings, Environment; off by default). Morning fog
  that builds and burns off, from mist to pea soup, rolled per 12 minutes of
  wall-clock time and likeliest when the sky is at dawn. Fog color, the sky,
  sun strength, shadows and stars follow it. `?weather=clear`, `clouds`,
  `mist`, `fog` or `soup` pins it for testing.
- **A welcome for the ring tour.** The first tour on a device opens with a
  short greeting, a line on how the forest is made, and how to take over;
  later tours say a line. It shows as a caption and is read aloud when
  narration is on. The tour also says when it has been round every grove and
  says goodbye when you take the wheel. The copy is a set of named variables
  in `tourScript.ts`.

### Changed

- **The guided tour ends at the redwood.** After the last grove it says so,
  drives back in along the spoke and pulls up at home facing the tree, and
  the cart is the rider's again. It used to go round the rings forever.
- **The tour sweeps onto the ring.** Riding out from the redwood, the cart
  used to crawl for some seconds before the first junction and turn sharply;
  the spoke now joins the ring by a curve, as the loop's other corners do.
- **Junction plazas are smaller**: 3 m, down from 6 m, just enough paving
  for the tour's turn.
- **A new lantern cart**: an oak book wagon with open rails, a row of books
  and a stack, tall spoked wheels, and a brass lantern on an iron hook, in
  place of the box cart. Same size, and the wheels now roll at the rate the
  ground passes under them.
- **The splash describes the species.** It no longer mentions space
  colonization; it says that each genre grows as a real species with that
  tree's bark, leaf and habit, and names four of the nine.
- **The Flame of Knowledge is dated 1964**, not "about 1964", on its plaque.
- **The touch Brake button is gone.** Letting go of the drive stick already
  stops the cart in about a second, and steering or reversing hops off the
  tour. Space and the gamepad's left trigger still brake.

### Fixed

- **App docs say which commands run in `gutenberg_kg`.** `app/RUNBOOK.md`,
  `app/README.md` and `app/ios/README.md` still read as if the apps lived in
  `gutenberg_kg`: `gutenkg export-swift`, `make up` and `bundles/` paths were
  given "from the repo root". They now name the `gutenberg_kg` checkout, the
  golden-gate and corpus-copy commands use `../gutenberg_kg/bundles/...`, and
  the iPhone README's INSTALLATION.md link, which pointed at a file this repo
  does not have, goes to gutenberg_kg's copy.
- **Version comments name the check that exists.** Both `project.yml` files
  and `AppVersion.swift` said the app version tracks gutenberg-kg's and that
  `tests/test_app_version.py` enforces it. That test left with the split; the
  sites are kept in step by `scripts/check_version.py`.
- **Go to the grove no longer leaves a lantern trail behind.** The jump lands
  on the grove's stop, which is outside its radius, and the trail only
  cleared once the cart was inside the grove, so it led you back to where you
  had started. A jump now selects nothing, and a trail clears on reaching the
  stop.
- **The forest has PNG icons beside its SVG favicon**: a 32 px favicon for
  browsers that skip an SVG icon, and a 180 px `apple-touch-icon` for iOS
  home-screen bookmarks. Without them those kept showing the old tree icon.
  `make icons` renders both from the seal.
- **The opening screen scrolls, so Start driving is always reachable.** The
  start screen sat inside an `overflow-hidden`, `touch-action: none` shell
  with no scroller of its own, so on a short window or a phone the button
  fell below the fold and could not be reached. The screen is now its own
  vertical scroller.
- **The ring tour is heard on iPhone and iPad.** Safari ignores speech until
  the page has spoken once from a tap, and the tour narrates from the render
  loop, so with narration on the tour was silent. The first tap, click or key
  press anywhere now speaks one silent utterance to open the gate, and
  turning narration on does it again, and the utterance being spoken is now
  kept referenced, since Safari can drop one nothing points to. Speech is
  also muted by Silent Mode, unlike video, so an iPad with narration on that
  says nothing may just be muted.
- **Console warning about `PCFSoftShadowMap`.** The canvas asked for a shadow
  type three r186 removed; it now asks for the one that replaced it.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
