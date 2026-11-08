# Release Notes -- v1.40.0

> Released: 2026-11-08

The Forest gets faster and tidier, saves the moots you hold, and the app gains
a new icon, an iPad bottom bar, and fixes for diaries, PDF sharing and follow-up
questions.

### Added

- **A new app icon.** `app/icon/AppIcon.icon`, an Icon Composer document,
  replaces the flat icon sets on iPhone, iPad and Mac. The seal's rim, ring,
  face and KP are separate layers, so the system draws them in its light, dark,
  clear and tinted styles. `make icons` now renders only the splash and web PNGs.
- **Chat, Browse and Forest from the bottom on iPad**, as the phone's tabs do,
  without opening the sidebar. Chat returns to the open conversation.
- **Live moots are kept.** A moot that finishes is saved on the device under
  **Your moots**, plays back with no worker, and can be deleted. One closed
  early is not saved.
- **Illustrations show their render time** under the picture, as answers show
  their synthesis time.
- **Anthropic as a worker provider.** Settings lists **Anthropic (cloud)** beside
  oMLX, Ollama and OpenAI, for a worker running gutenberg_kg 1.34.0 or later
  with an `ANTHROPIC_API_KEY`. The model list comes from the worker.

### Changed

- **The forest draws faster.** Fir, pine and oak leaves use far fewer triangles.
- **Shadows have their own setting, off by default.** It used to share a switch
  with the undergrowth; turning shadows off about doubled the frame rate on an
  iPad mini. When on, every shadow is drawn, on touch screens too. Undergrowth
  and wind stay on by default. Devices that had the old switch on start with
  shadows off.
- **A shorter top bar in the forest:** clean view, screenshot, the camera, home
  and Browse. The clock, silent mode, Moots, settings, About and Exit move to the
  three-dot menu, which now shows at every screen size. The camera button steps
  through the four views, in place of the row in Settings; the C key still works.
- **The forest's title card reads "Knowledge Press - *The Forest*".**
- **Touch screens:** Guided tour and Read sit side by side, centered on the
  search bar. On tablets the book and tour cards sit beside the drive stick,
  above the search bar. Clean view also hides the map, Guided tour and Read,
  leaving the drive stick.
- **God's eye starts from a clear view.** Switching to it closes the open cards.
  **Fly there** hides them during the flight and opens the tree's card on
  landing.
- **No worker is set by default.** The web forest no longer assumes
  `http://localhost:8000`, and **Hold a new moot** appears only once a worker is
  set. In the app, the forest uses the app's worker address, and **Reset all
  settings** clears it.
- **On-device answers use the window the device has.** Devices that report an
  8,192-token window (newer chips under iOS 27 and macOS 27) get passages twice
  as long. The model is also kept warm between questions.
- **Settings:** Worker sits under Answers, beside the engine that uses it, and
  Delete all conversations is last.

### Fixed

- **Pepys opens from the forest.** The reader built a diary entry by entry,
  three queries for each of Pepys's 3,358 days, and never finished. A diary now
  loads in one query: about 3 seconds for Pepys on a Mac.
- **A follow-up question stays in the conversation's scope**, after a suggested
  question, Ask about this book, or reopening the conversation. A new
  conversation returns to the scope chosen in the picker.
- **Share as PDF opens on a finished file.** On iPhone and iPad the share sheet
  half-drew while the PDF rendered; now a "Preparing PDF..." indicator shows,
  then the sheet opens.
- **The context window shows its real size.** The Answers section always said
  4,096 tokens; it now shows what the model reports.
- **In the forest on touch screens,** the drive stick and buttons no longer
  cover the reader or a plaque.
- **In the app's forest,** the user guide links open in the browser, and About
  no longer offers `?meteors=` links, since the app has no address bar.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
