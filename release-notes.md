# Release Notes -- v1.23.0

> Released: 2026-09-25

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

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
