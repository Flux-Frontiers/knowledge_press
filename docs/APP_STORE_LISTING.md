# App Store listing

The text in App Store Connect, kept here so the next release can update it
in one place. Character limits are Apple's.

Store page: <https://apps.apple.com/us/app/the-knowledge-press/id6812116080>
(Apple ID `6812116080`). The iPhone, iPad and Mac apps are one Universal
Purchase on the same record, so the same link serves both; `?mt=12` opens the
Mac tab.

## Name (30)

The Knowledge Press

## Subtitle (30)

Great books, searched offline

## Promotional text (170, changeable without a new version)

Live on iOS since 2026-11-06, with 1.34.1:

```text
Walk a 3-D forest where every tree is a book, then ask it a question. 261 classics and four diaries on your device, and every answer shows its sources.
```

Promotional text goes live on the current build the moment it is saved.

### Mac: apply once a build with the Forest is live

The Mac page keeps this until then, since the Forest text would describe a
feature its store build lacks (Guideline 2.3):

261 classic books and four diaries on your Mac. Ask a question, get an
answer written from the passages it found, with every source shown.

Then use the iOS text above, with "on your Mac" for "on your device".

## Description (4000)

Per version. This text is for 1.34.1 and later: Ask about this book's
book-only scope and the working Siri shortcut both need 1.34.1. Paragraphs
are on one line each, so it pastes cleanly. The same text serves the Mac.

```text
The Knowledge Press is a library of 261 public-domain books and four diaries that you can search and question, entirely on your device.

Ask it anything: what Marcus Aurelius says about anger, how Darwin describes the Galapagos finches, where Pepys was on the day of the Great Fire. The app searches the whole library two ways at once, by meaning and by exact wording, and answers from the passages it found. Every answer shows its sources, and marks which passages the model actually read.

WORKS OFFLINE

The books, the search index and the language model are all on the device. Nothing you ask is sent anywhere. There is no account, no sign-in, and no tracking. It works in airplane mode.

THE LIBRARY

Twenty genres: philosophy, English, American, Russian, French, German and Spanish literature, the ancient and classical world, drama and Shakespeare, science fiction, horror, biography, letters, travel, natural history and sacred texts. Plato, Aristotle, Epictetus, Marcus Aurelius, Kant, Nietzsche, Homer, Dante, Cervantes, Austen, Dickens, Melville, Tolstoy, Dostoevsky, Twain, Poe, Shelley, Stoker, Verne, Wells, Darwin, Thoreau, Whitman, and more.

Four diaries, searchable by date: Samuel Pepys, John Evelyn (two volumes), and Boswell's journal of his tour of the Hebrides with Samuel Johnson.

READ, NOT JUST SEARCH

Browse the library by genre, open any book, and read it chapter by chapter. The diaries open by date. Every source passage under an answer can be read in full.

THE FOREST

Every book in the library grows as a tree in a 3-D forest, one grove for each genre. Drive a cart along the roads, or take the guided tour, which stops at each grove. Open a tree to see its book, read it, or ask a question about that book alone. Each book in Browse and each source under an answer has a Tree button that takes you to its tree. The forest works offline, like the rest of the app.

ANSWERS YOU CAN CHECK

The app searches first and writes second, and the order never changes. An answer is written only from what the search found, and each passage that reached the model is marked. If the passages do not support an answer, it says so instead of inventing one. The settings let you tune how many passages are read, how closely they must match, and how the model writes, and every answer records the settings that produced it.

CHOOSE WHERE THE MODEL RUNS

On-device is the default and uses Apple Intelligence on your iPhone, iPad or Mac. Private Cloud is optional: it sends your question and the selected passages to Apple's Private Cloud Compute for a larger model, under Apple's privacy guarantees, and never to us. Or turn answers off and use the app as a search engine for the classics.

ASK FROM SIRI

Ask The Knowledge Press from Siri and Shortcuts.

REQUIREMENTS

Search, reading and browsing work on any iPhone, iPad or Mac running iOS 26, iPadOS 26 or macOS 26. Written answers need Apple Intelligence.

The Knowledge Press is not affiliated with Project Gutenberg. The texts are public domain; Project Gutenberg and the Internet Archive are acknowledged as their sources.
```

## Keywords (100, comma-separated, no spaces)

classics,books,library,philosophy,literature,offline,reader,search,shakespeare,plato,diaries,homer

## What's New (per version)

### 1.40.0

iOS:

```text
A smoother forest and a new icon.

- A new app icon, in light, dark, clear and tinted styles.
- The forest draws faster, with a shorter top bar and a camera button. Shadows have their own setting.
- On iPad, switch between Chat, Browse and the Forest from a bar at the bottom.
- Pepys's diary opens from its tree in the forest.
- A follow-up question stays in the part of the library you first asked about.
- On newer iPhones and iPads, on-device answers read longer passages.
- Share as PDF opens faster.
- Moots held with your own GutenbergKG worker are now kept on the device.
```

Mac (the first Mac version with the Forest; the Mac last shipped 1.32.0):

```text
The Forest is here. Walk a 3-D forest where every tree is a book, right inside the app and with no network needed. Open a tree and click Ask about this book to ask that book a question.

Also new:
- A new app icon, in light, dark, clear and tinted styles.
- Tree buttons in Browse and on answer citations take you to that book's tree.
- Browse search finds titles as well as authors.
- A follow-up question stays in the part of the library you first asked about.
- On newer Macs, on-device answers read longer passages.
- Moots held with your own GutenbergKG worker are now kept on the device.
```

### 1.34.1

iOS:

```text
The Forest is here. Walk a 3-D forest where every tree is a book, right inside the app and with no network needed. Open a tree and tap Ask about this book to ask that book a question.

Also new:
- Tree buttons in Browse and on answer citations take you to that book's tree.
- Browse search now finds titles as well as authors.
- "Ask The Knowledge Press" now works with Siri.
- The forest no longer stays zoomed in on iPhone after you tap the query field.
```

Mac (the zoom fix is iPhone only):

```text
The Forest is here. Walk a 3-D forest where every tree is a book, right inside the app and with no network needed. Open a tree and click Ask about this book to ask that book a question.

Also new:
- Tree buttons in Browse and on answer citations take you to that book's tree.
- Browse search now finds titles as well as authors.
- "Ask The Knowledge Press" now works with Siri.
```

### 1.32.0

iOS:

```text
265 books, ten of them new: Gogol's The Mantle, and Other Stories, the letters of Lady Mary Wortley Montagu and of Charles Lamb, Chekhov's Plays, Second Series, Synge's The Playboy of the Western World, the Raven Edition of Poe (volumes 2-5), and Cicero's De Officiis.

- Save an illustration to Photos or Files with the new Save Image button.
- Export a chat as a PDF, with its question, answer, quoted passages and pictures, or as Markdown as before.
- On iPad, Browse always has a way back to the chat, even on a fresh install.
- The layout now follows window width, so iPad Split View and folding iPhones get the right one.
```

Mac (the Browse and worker-address fixes were already in the Mac's October
builds, and the layout change is iPhone and iPad only):

```text
265 books, ten of them new: Gogol's The Mantle, and Other Stories, the letters of Lady Mary Wortley Montagu and of Charles Lamb, Chekhov's Plays, Second Series, Synge's The Playboy of the Western World, the Raven Edition of Poe (volumes 2-5), and Cicero's De Officiis.

- Save an illustration with Save Image, or send it with Share.
- Export a chat as a PDF, with its question, answer, quoted passages and pictures. Save as PDF and Save as Markdown are in the export menu.
```

### 1.28.0

First App Store release.

## Screenshots

Apple's asset best practices: show the app in use, lead with the strongest
feature, and tell a story in order. The store takes up to 10 per device, and
the first three can appear in search results, so they carry the pitch. Every
asset must suit a 4+ audience even though the app is rated 13+. No prices,
URLs, award claims, Project Gutenberg logo, or other platforms' logos.

The set below is for versions after 1.33.0: slot 06 shows title search in
Browse, and slot 03's card shows Ask about this book with the book-only
scope, both of which came after 1.33.0. All shots use dark mode, the
Simulator default (`SIM_APPEARANCE=dark`); do not mix modes in a set. iPad
shots are landscape (rotate the Simulator with Cmd-Left before capturing);
iPhone shots are portrait. Captions are in `scripts/store_captions.tsv`, one
per slot, the same on every device.

| Slot | Screen | Caption | Capture on |
|---|---|---|---|
| 01 | An answer with its source passages showing | Ask the classics. Every answer shows its sources. | Simulator |
| 02 | The Forest wide, no card open: the god's-eye view of the groves, or the start view around the redwood | Walk a forest where every tree is a book. | Simulator |
| 03 | A tree's card open, Ask about this book showing | Ask any book a question. | Simulator |
| 04 | Source passages expanded, the ones the model read marked | See which passages the answer was written from. | Simulator |
| 05 | The reader, a quiet passage (not *Macbeth* I.ii) | Read any book, chapter by chapter. | Simulator |
| 06 | Browse, an author or title typed in the search field ("Dickens", "divine") | Find any book by title or author. | Simulator |
| 07 | Pepys's diary on a chosen date | Open Pepys's diary on any day. | Simulator |
| 08 | An answer with Airplane Mode on in the status bar | Nothing you ask leaves your device. | Physical device |

Slot 08 needs a real iPhone or iPad: the Simulator's status bar has no
Airplane Mode icon. On the Mac, skip it. A Siri slot was dropped: a Siri
exchange does not read well as a still.

### Capturing

1. Stage the Forest and build: `make ios-stage-forest`, then
   `make ios-sim SIM="iPhone 17 Pro Max"` (and `SIM="iPad Pro 13-inch (M5)"`).
   Without the staged Forest the Forest tab is empty. The corpus must already
   be exported (`gutenkg export-swift --verify` in gutenberg_kg), and
   on-device answers need Apple Intelligence on this Mac.
2. In Settings, clear the Worker field and pick On-device. Delete leftover
   chats so the sidebar holds only the ones the shots need.
3. `ios-sim-launch` sets the 9:41 status bar. Take each shot with
   `make ios-sim-screenshot SIM=...`, which writes
   `screenshots/<SIM>-<time>.png`, and move it to
   `screenshots/raw/iphone/<slot>-<name>.png` (or `ipad/`). For the Mac,
   crop as under "Mac screenshots" below, but end the ffmpeg output name in
   `.png` (the script reads PNG only) and save it in `screenshots/raw/mac/`.
4. `make store-shots` writes `screenshots/store/<version>/<device>-<slot>.png`
   at 1320x2868, 2752x2064 (iPad, landscape) and 2880x1800, opaque, and a
   `contact-<device>.png` per device. It fails if a size is wrong, a file has
   alpha, a slot has no caption, or a device has more than 10.
5. Upload in slot order under each device size in App Store Connect.

## Product page header

iOS 27 shows a creative asset at the top of the product page. App Store
Connect takes 5244x2950 or 3840x1646, no alpha. Apple's guidance keeps the
focal point near the center, since each device crops differently.

The 1.34.1 header is a render of the real forest: the start view of the
redwood with its text hidden, the crescent moon of 2026-10-15 at dusk, leaves
at their highest setting, 5244x2950. In Apple's preview the moon sits near
the right edge on iPhone and well inside the frame on iPad. The file is
`screenshots/store/header/header-crescent-down-5244x2950.png` (git-ignored).
The Search Results asset is unset, so screenshots appear there.

## URLs

- Support: https://flux-frontiers.github.io/knowledge_press/support.html
- Privacy policy: https://flux-frontiers.github.io/knowledge_press/privacy.html
- Marketing (optional): https://github.com/Flux-Frontiers/knowledge_press

## Availability

All storefronts except China mainland. The setting belongs to the app, so
later versions keep it. Hong Kong, Macau and Taiwan are separate storefronts
and stay in.

App Review notes and the submission history are kept outside this
repository.

## The Mac version

Same record as iOS (Universal Purchase): name, subtitle, category, age
rating, privacy, availability and price are shared. The macOS version page
has its own text: the iOS promotional text, description, keywords and URLs
above, with "on your Mac" for "on your device".

The blocks above count the 1.32.0 corpus: 261 books plus four diaries, 265
works in all. The description is per version, so the count changes only when
a new version's text is edited.

### Mac screenshots

Apple takes 1280x800, 1440x900, 2560x1600 or 2880x1800. The 1.40.0 set is
captured from the app's window, not the screen: size the window to exactly
1440x900 points, which on a Retina display is 2880x1800 pixels, and capture
just that window with no shadow:

```sh
osascript -e 'tell application "System Events" to tell process "KnowledgePress" to set size of window 1 to {1440, 900}'
screencapture -x -o -l<window-id> out.png   # window id from CGWindowListCopyWindowInfo
```

Resizing needs Accessibility permission for the app that runs the script. Save
each capture opaque at 2880x1800 as `screenshots/raw/mac/<slot>-<name>.png`;
`make store-shots` captions it. The forest pauses and opens its settings when
its window loses focus, so capture a forest scene after a short delay, with the
window in front and the panel closed.

Clear the Worker field in Settings first, or every answer shows "Cannot reach
the worker" and a Render button. Set Scope to **all** and turn off the forest's
**Show geometry & frame rate**. The 1.40.0 set uses slots 01-07 of the table
above; slot 08 is skipped on the Mac. Slot 01 asks "marcus aurelius on death",
slot 03 is *Moby Dick*'s card at dawn, slot 04 asks "In Moby Dick, why does Ahab
hunt the whale?", slot 05 is *Pride and Prejudice* chapter II, slot 06 searches
"dickens", and slot 07 is Pepys on 2 September 1666.

## Category

Primary: Books. Secondary: Education.

## Age rating

13+ (questionnaire answered 2026-09-27: infrequent mature themes, sexual
content, realistic violence, weapons, profanity; nothing interactive).
