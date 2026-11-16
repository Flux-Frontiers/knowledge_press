# Release Notes -- v1.50.0

> Released: 2026-11-16

1.50 marks reading aloud and achievements; there are no 1.42-1.49 releases.

### Added

- **A view of the Wayfarer's Wheel.** The camera button (and C) gains a
  fifth view, after God's eye: down on the Wheel at a slant,
  north up, the table filling the screen. Driving off returns to the cart's
  view. The views now step In the cart, Behind the cart, High view, God's
  eye, the Wheel, and round again.
- **The Wayfarer's Wheel has a card.** Beside the table, or looking down on
  it, a card shows its level and this ride's progress, with a button that
  opens the full plaque and map. It takes the redwood's card's place there.
- **The Wheel's studs grow.** Each grove's stud rises and widens a little
  with every visit to the grove (driving in, or a stop on the ring) and every
  opening of one of its books, up to a pin about a hand high. The studs are
  shaded enamel pegs now, not flat glowing discs, and the plaque's key shows
  each grove's count. The save keeps the counts.
- **Achievements.** Four tracks, each bronze, silver and gold: Wayfarer
  (ride the whole ring home to the redwood; three rides; a ride in every
  season), Explorer (groves visited), Reader (books pressed) and Curator
  (exhibit plaques read). The Press tab lists them with what the next level
  asks; a card, and with narration on a spoken line, marks each level.
- **The Wayfarer's Wheel.** A bronze table on the hub plaza, in the widest
  gap between spokes: the forest's roads in relief, true to north, with a
  stud per grove that lights as the ring stops there, a gold pin for a whole
  ride, and a rim in the Wayfarer level's metal. Built for phones: no
  textures, one merged bronze mesh and two instanced stud meshes. Tap it for
  its plaque.
- **The ring remembers where you got to.** The groves stopped at on the lap
  under way are saved, so a ride broken off, or cut short by a reload, picks
  up where it left off and stops only at the rest.
- **The ring roads on the minimap.** Both rings are drawn under the groves
  and exhibits, brighter while riding the ring.
- **Twilight.** A new time of day between dusk and night: the sun 4° below
  the horizon, the stars out, the sky still lit. It picks this evening's or
  tomorrow morning's twilight, whichever has the moon higher, and sits in the
  time-of-day cycle after dusk.
- **A drone's fly-in: `?flyin`.** From beyond the forest's edge, low over the
  crowns and down the spoke road toward the redwood's plaque, round the
  redwood, and out onto the start screen's own slow circle, so it ends on the
  view the app opens with. Every leaf, shadows and the undergrowth on;
  `&time=dawn|dusk|twilight|night`.
- **Ride the visitor's craft: `?ufocam`.** The landing starts as soon as you
  press Start, wherever you are, and the camera rides under the craft's belly:
  looking ahead and down along its path over the crowns, down onto the pad,
  then round to the art tree as it grows. It loops, runs in daylight (or
  `&time=dawn|dusk|night`), and works in every camera mode. The More menu
  offers it only while the visitor's in-app event is on (or with
  `?event=visitor`).
- **The forest in Blender** (`web/scripts/forest3d/`, tooling only). An
  exporter builds the forest from the game's own modules and writes its
  trees, leaves, corpus redwood, roads, plazas and grove grounds. A Blender
  script rebuilds them as a Cycles scene with leaves as geometry-node
  instances. The result renders as stills, or as Looking Glass quilts through
  quiltwright. One grove can be exported alone as a diorama for holograms.
  It can also light the forest with Blender's online Essentials HDRIs
  (sunrise, sunset, forest, night), and pave the roads with Essentials bricks.
  Time presets (noon, sunrise, sunset, night) come from the game's own sky
  model, and night renders the game's star catalog as the sky. A textured
  forest floor and scattered grass tufts cover the ground near the camera.
  The game's own grass tufts and rocks stand where the game puts them; their
  placement moved from Environment.tsx into forestFloor.ts so both share it.
- **The app's Browse reader reads chapters aloud.** A play button in the
  toolbar reads the chapter a paragraph at a time with the system's speech,
  tints the paragraph being read and keeps it in view, and goes on to the
  next chapter; tap a paragraph to read from there. Settings has a Reading
  aloud section with a voice and a speed. Starting it stops a book the
  forest is reading. The automatic voice matches the book's author, from the
  `gender` and `accent` gutenberg_kg 1.36.0 writes into `core.pack`; an
  older pack reads in the system voice. The reader now sets chapters as the
  forest does (paragraphs, verse lines, italics, small notes and captions):
  `ChapterBlocks` is the Swift twin of the forest's block model, held to the
  same fixtures, and the two agree on all 54,444 chapters.
- **A night-sky splash with a book's first line.** The launch splash is a
  starry night (twinkling unless Reduce Motion is on) with the logo, the
  name, and the opening line of one of twenty corpus books, word for word
  as the corpus holds it, a different one each launch. It stays long
  enough to read the line, 6 to 10 seconds; a tap skips it.
- **The forest reader reads books aloud.** A play button (or Space) reads
  the chapter a paragraph at a time in the device's own voices, tints the
  paragraph being read and keeps it in view, and goes on to the next chapter.
  Tap a paragraph to read from there. The voice matches the author (Austen
  British and female, Twain American and male), from a `voice` the catalog
  now carries for 252 of 265 books. Settings adds a Reading voice and a
  Reading speed. The book remembers the paragraph for next time. On iPhone
  and iPad a reading stops when the screen locks and picks up that paragraph
  again on return.
- **Keep listening after the book closes.** The reading goes on while you
  drive, with a strip above the book cards to pause it, stop it or open the
  book again. While a book is read, the ring tour shows its cards but does
  not read them aloud; once the book stops, the tour speaks again if
  **Read each grove aloud on the ring** is on. A moot pauses the book, and
  the book goes on from the same paragraph when the moot closes.
- **Shots from the menu.** The app has no address bar, so the More menu
  starts the drone's fly-in to the redwood. **Ride the visitor's craft** is
  offered there only while the visitor's in-app event is on. In a shot the
  menu offers **End the shot** instead.

### Changed

- **The forest floor is photographed ground.** The flat canvas speckle is
  replaced by Poly Haven's forrest_ground_01 (CC0), a 2 m square of grass,
  twigs and leaf litter, repeated at its true size. Its average color is the
  old one's, so every season keeps its color.
- **The forest reader sets books as books.** Prose fills the page as
  paragraphs instead of keeping the printed edition's short lines; verse and
  plays keep their lines, with a hanging indent where one wraps. `_word_`
  shows as italics, footnote marks as small raised numbers, footnotes and
  sidenotes small and gray, and illustration tags as captions. The rule that
  unwraps prose is the app reader's, ported to TypeScript and held to it by
  fixtures both test suites read; the two agree on all 54,444 chapters of the
  corpus.
- **The forest reader has a text size control**: four steps, saved.
- **A tree's card shows its year and chunk count on every screen**, beside
  the author: "Herman Melville · 1851 · 2,922 chunks". The count was a faint
  line hidden on phones, next to the trunk radius, which is gone.
- **Shadows across the whole forest on a Mac.** A Mac or desktop that takes
  an 8192 map now shadows every grove from one fixed map 310 m each way,
  instead of 120 m round the cart.
- **Shadows fade in on iPhone and iPad.** The shadow map follows the cart,
  60 m each way on 2048, and every shadow fades out over the outer quarter
  of the map, so groves ease into shadow as the cart nears them instead of
  switching on at the edge. A shot (`?flyin`, `?ufocam`) takes the shadow
  map with its camera.
- **Photo bark on the corpus redwood.** Poly Haven's metasequoia_bark (CC0),
  repeated at its true 1.94 m size, replaces the drawn bark.

### Fixed

- **A ride finishes the ring it is on.** A ride set off, or picked up,
  partway round a ring used to leave for the other ring and come back later
  for the groves behind it. It now carries on round its own ring until every
  grove there is seen, then takes the spoke to the other ring, then goes home.
- **The Wayfarer's Wheel stands on the compass rose's paper**, 7.1 m out
  between two wind points, instead of on a dark point where it was hard to see.
  Its roads are gilt, bright against the bronze, and a lamp on a post at its
  north edge lights the map after dark. Tapped, its plaque now carries a flat
  map of the ring: a numbered stud per grove, in its color once this ride has
  stopped there, with a key to the numbers in the ride's order.
- **A phone reload puts you back in the forest.** When iOS kills the page for
  memory, the app reloads it, and the reload used to land on the start screen,
  as if the forest had quit mid-ride. The rider's place, and whether they were
  riding the ring, is now kept for the session, so the reload resumes there.
  Exit clears it, and a fresh launch still opens on the start screen.
- **The minimap's arrow stays on top.** On a phone's smaller map the ring
  passes about 3 px from each exhibit's diamond, and the cart's arrow slid
  under each one as it rode by, so the markers seemed to flash. The arrow now
  draws over every marker, and the diamonds are a little smaller on a phone.
- **Riding the ring from a grove no longer drives into trees.** The tour
  used to steer straight for the nearest road and ground against any trunk
  in the way, sometimes for good. It now backs off the tree it is parked
  at, turns in place to face the way out, and follows a path round the
  trunks to the road (leadIn.ts), at a steady pace while among the trees.
- **No white flash at launch.** The iOS launch screen is now the splash's
  night color, and the splash is opaque from its first frame.
- **The app icon shows on the splash and in About again.** It was looked
  up outside the folder the package bundles it in.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
