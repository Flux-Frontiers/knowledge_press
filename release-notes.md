# Release Notes -- v1.24.0

> Released: 2026-09-26

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

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
