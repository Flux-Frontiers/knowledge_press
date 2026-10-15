# Release Notes -- v1.30.0

> Released: 2026-10-14

### Added

- **The planets.** Mercury, Venus, Mars, Jupiter and Saturn stand among the
  stars where they are tonight, steady points a little larger than the
  brightest stars, in their own tints. Positions from JPL's approximate
  Keplerian elements (Standish), magnitudes from Mallama and Hilton (2018);
  a test checks them against JPL Horizons. Ported from the Art Techno plaza.
- **About, with tonight's sky.** The ? key, the info button in the bar (on a
  phone, the three-dot menu), or About on the start screen opens a page on
  what the forest is, which species grows each genre, the sky, every
  control, and how it was made. Its Tonight's sky section gives the moon's
  phase and the next full and new moon, the meteor showers active and
  coming up, the planets up tonight with their rising, setting and highest
  points, where to find Polaris, and a **Use my location** button.
- **`?meteors=10`.** A number alone multiplies tonight's whole meteor sky,
  sporadics and every shower in season; `?meteors=perseids:20` still pins
  one shower to its peak.

### Changed

- **A new start screen over the live forest.** While the forest grows, a
  still of it shows, by day or by night as your sky is now; then the live
  forest fades in behind the title in today's season and sky, the camera
  circling the redwood, lifted at night so the dark does not read as black. The title, a one-line introduction, **Start driving**, **Guided
  tour** and **About** sit bottom-left over a dark gradient, after the Art
  Techno plaza's start. The long description and the key boxes moved to
  About; a row of keys stays on desktop, one line on touch screens.
  **Exit**, the last button in the bar (on a phone, in the three-dot menu),
  goes back to it: panels shut, a tour ended, the camera circling again.
- **The season and the clock set themselves.** Each visit opens in the
  season of the date where you are (astronomical seasons, flipped south of
  the equator) and on the Live clock. The season buttons on the start screen
  and down the right of the desktop view are gone; settings and the clock
  button still change either until you reload.
  Neither is saved any more.
- **Drag to look.** A mouse or one-finger drag anywhere on the forest looks
  around, with no button to hold. The sideways look eases back to straight
  ahead when you let go, as the arrows do, and the tilt stays. A drag that
  ends over a signpost or the redwood does not click it. Off in god's eye.
  On touch screens this replaces the right-hand look stick.
- **Twilight and the moon in the star field.** The faint stars go first as
  the sky brightens, so dusk and dawn show only the brightest, and the moon's
  disc hides the stars and planets behind it.
- **Less over the forest on touch screens.** The Ride the ring button is
  gone on touch, where the Guided tour button rides the ring; it stays on
  desktop. The keyboard hints are
  hidden on touch too.
- **A one-row top bar on phones.** In portrait the button row wrapped three
  deep and ran under the minimap. The bar now holds home, **Browse** and a
  three-dot menu with the clock, silent mode, screenshot, clean view and
  settings; from 640 px up every button stays in the bar. The minimap sits
  under the bar instead of at a fixed offset, so the buttons cannot cover it.
- **One Browse panel.** The grove atlas, the book list and the press are now
  the Groves, Books and Press tabs of one panel, opened by **Browse** or by
  G, B and L as before. The Browse button shows the press count.
  The atlas's own Home and Ride the ring buttons are gone; the bar and the
  tour button already have them.
- **The behind-the-cart camera tilts up a little on a portrait screen.**
  Looking level, a tall screen was half road and cart; it now rests about
  8° up, so the cart sits at the bottom edge and more of the forest ahead
  shows. The look stick still tilts from there.

### Fixed

- **Stuck touch sticks.** When iOS swallowed a stick's release (a touch
  taken over by an edge swipe, the app backgrounded), the cart kept driving
  and the stick ignored new touches. A new touch now always takes the stick,
  and the owning finger lifting anywhere, every finger lifting, or the page
  losing focus releases it.
- **Phone landscape layout.** On a phone on its side the book card was
  stacked above the controls and rode up over the top bar. It now sits on
  the left above the drive stick, without its excerpt, and the search field
  sits on the bottom edge between the sticks.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
