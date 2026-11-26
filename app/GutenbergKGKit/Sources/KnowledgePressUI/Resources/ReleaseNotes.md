# Release Notes -- v1.60.0

> Released: 2026-11-25

1.60 marks forest sounds and bookmarks; there are no 1.52-1.59 releases.

### Added

- **The Spirit of Gutenberg**, a new exhibit: an Art Techno statue of the
  printer lifting one piece of type like a rising sun, its face a grid of
  pixels, 8.5 m tall like the Flame of Knowledge, floodlit to the top at
  night. It joins the timeline at 1455, the year of his Bible. The mesh is
  `web/public/models/spirit_of_gutenberg.glb` (40k triangles, WebP
  textures, meshopt-compressed geometry, 864 KB). It takes a glade of its
  own, so no other exhibit moves. Its plaque counts toward Curator, so a
  forest that had every plaque read drops from gold to silver until this
  one is read.

- **Eight more quests.** A full cart, Three tragedies, Lovecraft country,
  Barsoom, Extraordinary voyages, A Russian winter, Founding papers and
  Every grove join the first five, for thirteen. A forest that showed
  "quests complete" now shows 5/13; the five already done stay done.

- **Fifty-eight more lines for the launch splash**, for 78 in all: opening
  lines from Treasure Island to the Tao Te Ching, plus a few famous lines
  from further in, such as Yorick. Each is word for word from the corpus
  edition.

- **Time presets run on.** Dawn, Day, Dusk, Twilight and Night now start
  the sky at that hour and let it run at real speed, so picking Dusk brings
  the dark on over the next hour. The clock shows the forest's time. The
  fly-in, the UFO cam and the tree portraits still hold their hour.

- **Dusk sounds like dusk.** As the sun goes down the day birds settle and
  the crickets and frogs start while it is still light, instead of the
  full daytime mix until dark.

- **Forest sounds.** Recorded nature loops follow the sky and the season:
  crickets and frogs come up at dusk, a dawn chorus with the sunrise,
  birdsong by day with a lull around midday, and wind under it all. Winter nights are wind and owls,
  and an owl or a woodpecker calls now and then from somewhere in the
  trees. Everything quiets while a voice reads aloud and stops while the
  forest is hidden or in silent mode, and the wind is silent while Wind &
  gentle cart motion is off. A Forest sounds slider in Settings, under
  Environment, sets the volume or turns them off. The recordings are CC0, from Freesound;
  `web/public/sounds/CREDITS.md` lists each one.

- **Bookmarks and Continue reading.** A book's chapter list opens with
  Continue reading, which goes back to the chapter and paragraph you left,
  and a Bookmarks section. The bookmark button in the reader marks the
  paragraph at the top of the page, or unmarks it; swipe or right-click a
  bookmark to remove it. Reopening the chapter you left also opens at your
  place. The forest's reader remembers the paragraph you scrolled to, not
  only the one a voice was reading, and has its own bookmark button and a
  Bookmarks menu under the chapter menu. Kept on this device only.

- **A Flux-Frontiers fleet mark.** The Forest logo's book tree inside its
  two ring roads, redrawn in the fleet's Art Techno style, with the tagline
  GENRES . BOOKS . PASSAGES. It names the project wherever the fleet's
  other marks appear; the app icon, the press seal and the README's lockup
  are unchanged. `scripts/build_logo.py` draws the mark, a 64 px icon and a
  banner as SVG under `assets/` and writes the PNGs.

- **Three new achievement tracks.** Night Owl (press or read 1, 5 and 15
  books at night), Botanist (press books from 3, 6 and every kind of tree
  in the forest) and Moot-goer (watch 1, 2 and 5 moots) join Wayfarer,
  Explorer, Reader and Curator on the Press tab, each in bronze, silver
  and gold. Night Owl and Moot-goer start counting with this version;
  Botanist counts the books already in your press. Start over clears them.

- **Night lighting in the forest.** After dusk the Corpus Redwood is
  floodlit to its top, trunk and crown, brightest at the root flare, and
  its light cuts through part of the night fog so it reads from across the
  forest. The book tree nearest the cart, within about 32 m, fades on in
  warm light as you ride up to it (fully lit within 16 m) and fades off as
  you leave; another tree takes over only when it is clearly nearer. Both
  are glows in the existing shaders, not added lights, so the frame costs
  about the same. Tree portraits (`?shot=`) also take `time=night`.

### Changed

- **The quest count reads plainly.** The top bar says "3/13 quests" while
  quests remain and "quests complete" once every quest is done, instead of
  a bare count such as "5/5", which read like the fifth quest of five.

- **Ride the ring sits level with the search bar.** On a Mac or a desktop
  browser at least 768 px wide, the button now lines up with the search bar
  along the bottom edge, at the same 44 px height as the other HUD buttons,
  instead of floating small above the bottom row. Narrower windows, and
  god's eye with the timeline open, keep it higher so it clears the search
  bar and the timeline panel.
- **The web forest loads its libraries as separate files.** three.js and
  the other libraries (React, react-three-fiber, zustand, lucide) now build
  into their own chunks, beside the forest's own code, so a release that
  changes only the forest leaves them cached for a returning visitor. The
  forest's own code is 630 kB (221 kB gzipped); it was one 1.78 MB file. The
  build no longer warns about chunk size: the limit is 1000 kB, since
  three.js alone is about 790 kB.
- **Catalog refreshed for four books whose chapters were fixed.**
  gutenberg_kg #278 turned plain-text chapter lines into headings in *At the
  Earth's Core*, *The Great God Pan*, *The Food of the Gods* and *Second
  Treatise of Government*, and the corpus was rebuilt. Their chunk counts
  move by one to four (*At the Earth's Core* 646 to 650) and two excerpts
  change. The web books (`web/public/books`, not tracked) were re-exported
  the same day.

### Fixed

- **Dawn, Day and Dusk no longer depend on the device's time zone.** The
  presets looked for sunrise and sunset in the device's calendar day. Where
  the device's zone and the forest's place were several hours apart, that
  day could hold no sunset, and Dusk showed noon. They now search the
  place's own solar day, as do Twilight and Night. With the zone and the
  place in agreement the presets move by a few minutes at most.

- **No more groves popping in through the fog.** The forest no longer hides
  the groves the fog has swallowed. They still showed as shapes against the
  sky, so they popped in as the fog thinned or the cart came near; now
  every grove is always drawn, on the Mac, iPad and iPhone alike.

- **Firs and pines keep their needles.** The season set every tree's leaf
  colours and how many leaves show, so in autumn the conifers turned orange
  and gold and lost 30 percent of their needles, and in winter all but 10
  percent, which left the Science Fiction, Natural History, Ancient Classical
  and Sacred Texts groves looking dead. Species now carry an `evergreen` flag
  (fir and pine); evergreens draw every needle in a dark green that is fresher
  in spring and frosted in winter, as the Corpus Redwood already did.
- **The fir's lowest limbs no longer lie on the ground.** Its clear bole was
  10 percent of the tree and its leaves sat below their section tips, so the
  lowest, widest tier grew a long limb that sagged to the grass and, carrying
  the tips around it, grew nearly as thick as the trunk. The fir now clears 16
  percent of its height and lifts its sprays slightly. The exhibits, which keep
  clear of crowns, stay exactly where they were.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
