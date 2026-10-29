# Release Notes -- v1.31.0

> Released: 2026-10-29

### Changed

- **The Mac app is approved for the Mac App Store.** App Review approved
  The Knowledge Press for macOS on 2026-10-28; the iPhone app is submitted
  and awaiting review. The app runbook's first-submission checklist records
  both, and checks off the store metadata and privacy URL that a submission
  requires.

- **Forest: rounded curbs at the crossings.** Where a spoke meets a ring,
  each corner is rounded by a 2 m curb in place of the 3 m paved disc that
  covered every crossing, so the roads read as one road bending; at the
  outer ring the spoke ends in a T and only its two inside corners are
  rounded. The tour's turns stay on the brick, tested wheel by wheel, and
  signposts keep 5 m from a crossing. Ported from The Family.

- **Forest: Empty the press.** A button at the bottom of the Press tab takes
  every book out of the press, after asking. **Reset all settings** no longer
  touches the press; the press and visited groves are progress, not settings.

- **App runbook: the worker is local-only by default.** gutenberg_kg's
  worker now answers only its own Mac; "iPhone cannot reach the worker"
  says to set `WORKER_BIND=0.0.0.0` for the phone, and why a
  `HANDLER_SECRET` would lock out a phone installed normally. The app
  guide's Settings page says the same under Worker.

### Added

- **A logo for the Forest.** `logo.svg`, at the top of `web/README.md`:
  a book grown as a tree inside the forest's ring roads, its leaves turning
  from spring to autumn, and an open book under the title. In the same style
  as The Disulfides' logo.

- **Hold a live moot in the Forest.** Moots gains "Hold a new moot": pick two
  books and a topic, and a local GutenbergKG worker (its new `moot_start`,
  `moot_turn` and `moot_stop` ops) makes each turn while you watch. The
  player shows the next book "thinking" and rings its tree, plays each turn
  as it lands, and asks for the next as soon as one arrives, so the worker
  makes it while the current one is read. Closing the moot ends it on the
  worker; a failed turn can be tried again. Settings gains a "Live moots"
  section for the worker's address (`http://localhost:8000` by default) and
  an optional token. Works from the dev server in Chrome and Safari, and
  from the published forest in Chrome once local network access is allowed.
- **A Moots page in the Forest guide.** `docs/forest/moots.md` covers opening
  and playing a moot, its controls, reading aloud and the author voices, what
  each browser offers, and where moots come from. Settings lists "Read moots
  aloud" and the two voice choices, and `web/README.md` mentions moots and
  lists `moots.ts` and `MootOverlay.tsx`.
- **A second moot: *Meditations* and *The Prince* on virtue.** Marcus
  Aurelius and Machiavelli, eight turns, each book in its author's voice,
  argued with fresh passages each turn and a shaped ending (gutenberg_kg's
  turn intents): it opens, asks, gives examples, concedes, and closes with
  what each takes from the other.
- **Moots: books that talk to each other.** In the Forest, a new Moots button
  (and a Moots item in the phone menu) lists saved moots: two books holding a
  conversation on a topic, each speaking only from its own text, written by
  gutenberg_kg's `gutenkg converse` and exported with
  `gutenkg export-web-moots` into `web/public/moots/`. Playing one opens an
  overlay styled like the Reader. Each turn is a speech bubble, the first
  book on the left in green and the second on the right in pink, with each
  book's name in its color, quotes in bold, citation tags dimmed and the
  cited passages underneath. The speaking tree is ringed in its color in the
  world. Lines are read aloud more slowly than grove narration, and the next
  turn follows when a line ends. Each book speaks in a voice matching its
  author, from the pack's `voice` (gender and accent, which gutenberg_kg
  looks up on Wikidata): a woman's book in a woman's voice, and the nearest
  accent the browser has (Twain gets an American man on Edge; Safari and
  Chrome have none built in, so a British one). Gender is a rule and accent
  a preference; voices that always speak come before optional downloads a
  browser may list without having; a translated author takes the system's
  accent. When both books need the same voice, the second speaks deeper.
  Nothing needs setting up: Settings gains "Read moots aloud" (on by
  default; the player's speaker button flips it, and off, turns advance at
  reading pace) and two optional voice choices, each "Automatic" until a
  listener picks one of the browser's English voices. A line that arrives
  before the browser has listed its voices waits for them instead of using
  the default voice.
- **The cart carries the press.** In the Forest, each book you press now rides
  in the lantern cart's bed, in its grove's color: an empty cart for a new
  player, standing rows, then flat stacks, then a heap over the side rails at
  a full press of 253. The load is one instanced mesh, so it adds one draw
  call at any count, and it stays under 1.2 m so the seat and behind cameras
  keep their view. The gallery's parked cart keeps its fixed cargo.

### Fixed

- **Forest: settings open at the top.** On a phone the settings card
  opened scrolled to its end, because it focused its "Back to the forest"
  button at the bottom. It now focuses the card itself and resets its
  scroll, again a frame later for iOS Safari. Ported from The Disulfides.

- **Back to the chat from Browse on Mac and iPad.** New chat was disabled
  while the current chat was empty, so on a fresh install, with no saved
  chats in the sidebar, Browse had no way back. It now stays enabled in
  Browse and returns to the chat without starting an empty one.
- **The Mac app starts with no worker address, and a cleared one stays
  cleared.** The Mac defaulted to `http://localhost:8000`, so on a Mac with
  no worker every answer showed "Cannot reach the worker", and clearing the
  field lasted only until the next launch because an empty stored value was
  read as never set. Every platform now starts empty, and an empty value is
  kept. `KGRAG_ENDPOINT` still sets the address for a launch from the shell.

### Security

- **Dependabot alerts cleared.** `source-map-js` 1.2.1 -> 1.2.2 in
  `web/package-lock.json` (a dev dependency of Vite and Tailwind; denial of
  service through crafted source-map offsets), and `mkdocs-material` 9.6.14
  -> 9.7.7 in `docs/requirements.txt` (DOM XSS in search suggestions).
- **vite 8.3.4** (was 8.3.0) for three advisories against 8.3.0-8.3.2,
  published after the entry above; the floor in `web/package.json` is now
  `^8.3.4`. Its bundler moves with it (rolldown 1.2.14, postcss 8.5.31).

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
