# Release Notes -- v1.51.0

> Released: 2026-11-16

### Added

- **What's new, after an update.** The first launch of a newer version on
  iPhone, iPad or Mac shows that release's notes in a sheet once the splash
  clears. A fresh install shows nothing; nor does the first update to this
  version, which has no earlier launch to compare against.
- **The web forest says when it is out of date.** A page left open in a tab
  checks the published `version.json` when the tab comes back into view, at
  most every ten minutes, and offers a reload when a newer version is out.
  The app's own forest never shows it.

### Changed

- **The canopy follows the season.** Spring shows half the leaves the leaf
  setting allows, summer all of them, autumn 70%, and winter is bare wood as
  before. Spring and autumn draw fewer leaves, so they run faster too.
- **Twice the leaves in the Mac app.** Every leaf level doubles there: Ultra
  hangs two leaves per chunk, the second beside the first on the same twig.
  Phones, iPads and the web forest in any browser keep their levels.
- **Two resets: Reset settings and Start over.** Reset all settings is now
  Reset settings and keeps everything earned, your place in each book among
  it (that was saved with the settings and lost on a reset). It also brings
  back a dismissed quest hint and turns clean view and the timeline off.
  Start over, below it, erases progress on the device: the press, visited
  groves, quests, achievements and the Wheel's studs, places in books and
  saved moots, and lets the visitor's landing play again. Settings are kept.
- **The season is back in the ... menu**, stepping Spring, Summer, Autumn,
  Winter, and is gone from the settings window, where the dialog hid what
  changed.

- **A chat saved as the app opens stays in the sidebar.** Listing the saved
  chats rewrites their index, and a listing that ran beside a save could write
  the older list last, so the chat stayed on disk but dropped off the sidebar
  until the next save. The store now takes one lock across reads and writes.
  This was also the occasional App CI failure in the relaunch test.

### Fixed

- **No white flash before the forest.** The page painted white until its
  stylesheet loaded, a Mac's web view painted white until the page's first
  frame, and the forest faded in before it had drawn, which Safari on an
  iPad can show as a white sheet. The page is dark from its first paint and
  the forest fades in only once it has drawn.
- **The cart's wheels sit on the paving.** The cart rode at the forest
  floor's height, so its wheels sank 3.5 to 6 cm into the roads, plazas and
  compass rose laid over it. It now rides on whatever is under it, easing up
  a curb over a few frames.
- **The cart's front wheels turn, on axles.** Only the rear wheels spun; the
  small front pair stood still as the cart rolled. Each pair now turns on an
  iron axle, the front faster for its smaller wheels.
- **Home leaves the Wayfarer's Wheel's view and god's eye.** Home, or a jump
  to an exhibit, from either view moved the cart but kept the camera where it
  was. It now goes back to the cart's view it was in before; from god's eye
  the camera dives down to it.
- **A quest says when it is done, with fireworks.** Finishing one
  (switching to winter for Bare wood, say) used to only drop its hint. Three
  shells now burst in the sky ahead, and a toast names it and the count,
  "Quest done · Bare wood · 5 of 5".
- **A quest stays done.** Bare wood counted only while it was winter, so
  going back to autumn took 5 of 5 back to 4 of 5. Done quests are now saved
  and kept; Start over clears them.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
