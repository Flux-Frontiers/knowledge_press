# Changelog

All notable changes to The Knowledge Press are documented here. Entries
before 1.23.0 are in the
[gutenberg_kg changelog](https://github.com/Flux-Frontiers/gutenberg_kg/blob/main/CHANGELOG.md),
where this code lived until September 2026.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

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

### Removed

- **Knowledge Press Forest: the "The Press" signpost** on the hub plaza.

### Changed

- **Knowledge Press Forest: the "In the cart" camera is at eye level.** It sits
  at a standing adult's 1.65 m (was 1.3 m), gazes level instead of slightly
  down, and uses a 60 degree field of view (was 72), so the horizon, plaques
  and plinths sit where they would on foot and tall pieces are not stretched
  at the frame's edges. Tilt up to take in a sculpture or the redwood.

### Fixed

- **Knowledge Press Forest: plaque posts no longer show through the text.**
  The lectern posts rose to 1.6 m, past the tilted board's centre, and came
  out through its face at either end; they now stop at 1.3 m, behind it.

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
