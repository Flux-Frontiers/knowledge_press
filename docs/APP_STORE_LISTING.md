# App Store listing

The text in App Store Connect, kept here so the next release can update it
in one place. Character limits are Apple's.

Store page: <https://apps.apple.com/us/app/the-knowledge-press/id6812116080>
(Apple ID `6812116080`). Both apps are live: the Mac since 2026-10-28, the
iPhone and iPad app since iOS 1.30.0 was released on 2026-11-02. iOS 1.34.1,
which carries the Forest, was approved on 2026-11-06. They are one
Universal Purchase on the same record, so the same link serves both;
`?mt=12` opens the Mac tab.

## Name (30)

The Knowledge Press

## Subtitle (30)

A library that answers back

## Promotional text (170, changeable without a new version)

261 classic books and four diaries on your device. Ask a question, get an
answer written from the passages it found, with every source shown.

On the Mac page "on your device" reads "on your Mac". The 261 count went to
the Mac page with 1.32.0 on 2026-11-02. Promotional text changes without a
new version, so the iOS page can be brought in line any time.

### Next: the Forest (apply once 1.33.0 or later is live)

The Forest first ships in the app in 1.33.0. Promotional text goes live on
the current build the moment it is saved, so this replaces the text above
only after a build with the Forest is on the store; before that it would
describe a feature the store build lacks (Guideline 2.3).

```text
Walk a 3-D forest where every tree is a book, then ask it a question. 261 classics and four diaries on your device, and every answer shows its sources.
```

Mac: "on your Mac" for "on your device".

## Description (4000)

The Knowledge Press is a library of 261 public-domain books and four
diaries that you can search and question, entirely on your device.

Ask it anything: what Marcus Aurelius says about anger, how Darwin
describes the Galapagos finches, where Pepys was on the day of the Great
Fire. The app searches the whole library two ways at once, by meaning and by
exact wording, and answers from the passages it found. Every answer shows
its sources, and marks which passages the model actually read.

WORKS OFFLINE

The books, the search index and the language model are all on the device.
Nothing you ask is sent anywhere. There is no account, no sign-in, and no
tracking. It works in airplane mode.

THE LIBRARY

Twenty genres: philosophy, English, American, Russian, French, German and
Spanish literature, the ancient and classical world, drama and Shakespeare,
science fiction, horror, biography, letters, travel, natural history and
sacred texts. Plato, Aristotle, Epictetus, Marcus Aurelius, Kant,
Nietzsche, Homer, Dante, Cervantes, Austen, Dickens, Melville, Tolstoy,
Dostoevsky, Twain, Poe, Shelley, Stoker, Verne, Wells, Darwin, Thoreau,
Whitman, and more.

Four diaries, searchable by date: Samuel Pepys, John Evelyn (two volumes),
and Boswell's journal of his tour of the Hebrides with Samuel Johnson.

READ, NOT JUST SEARCH

Browse the library by genre, open any book, and read it chapter by chapter.
The diaries open by date. Every source passage under an answer can be read
in full.

ANSWERS YOU CAN CHECK

The app searches first and writes second, and the order never changes. An
answer is written only from what the search found, and each passage that
reached the model is marked. If the passages do not support an answer, it
says so instead of inventing one. The settings let you tune how many
passages are read, how closely they must match, and how the model writes,
and every answer records the settings that produced it.

CHOOSE WHERE THE MODEL RUNS

On-device is the default and uses Apple Intelligence on your iPhone, iPad
or Mac. Private Cloud is optional: it sends your question and the selected
passages to Apple's Private Cloud Compute for a larger model, under Apple's
privacy guarantees, and never to us. Or turn answers off and use the app as
a search engine for the classics.

ASK FROM SIRI

Ask The Knowledge Press from Siri and Shortcuts.

REQUIREMENTS

Search, reading and browsing work on any iPhone, iPad or Mac running iOS
26, iPadOS 26 or macOS 26. Written answers need Apple Intelligence.

The Knowledge Press is not affiliated with Project Gutenberg. The texts are
public domain; Project Gutenberg and the Internet Archive are acknowledged
as their sources.

### Next: the Forest section (for the first version after 1.33.0)

The description is per version. Insert this section after READ, NOT JUST
SEARCH in the first submitted version after 1.33.0. It needs that version:
in 1.33.0, Ask about this book scopes the chat to the book's genre, and the
book-only scope came after it (CHANGELOG, Unreleased). The same text serves
the Mac.

```text
THE FOREST

Every book in the library grows as a tree in a 3-D forest, one grove for each genre. Drive a cart along the roads, or take the guided tour, which stops at each grove. Open a tree to see its book, read it, or ask a question about that book alone. Each book in Browse and each source under an answer has a Tree button that takes you to its tree. The forest works offline, like the rest of the app.
```

With this section the description is about 3,100 characters, under the 4,000
limit.

## Keywords (100, comma-separated, no spaces)

classics,books,library,philosophy,literature,offline,reader,search,shakespeare,plato,diaries,homer

## What's New (per version)

### 1.34.1

iOS submitted 2026-11-05 and approved 2026-11-06 (submission
`b571e655-428a-4cdc-bd8b-cbd7fb810c2f`). It is later than 1.33.0, so once it
is live on the iOS page the Forest items marked "Next" in this file apply
there: the promotional text, the description section, the screenshot set and
the featuring nomination.

### 1.32.0

Submitted 2026-11-02 for both platforms, build 826. iOS is set to release on
approval.

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

The set below is for the first submitted version after 1.33.0: slot 06 shows
title search in Browse, and slot 03's card shows Ask about this book with
the book-only scope, both of which came after 1.33.0. All shots use dark
mode, the Simulator default (`SIM_APPEARANCE=dark`); do not mix modes in a
set. iPad shots are landscape (rotate the Simulator with Cmd-Left
before capturing); iPhone shots are portrait.
Captions are in `scripts/store_captions.tsv`, one per slot, the same on every
device.

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

## Featuring nomination

Apple considers nominated apps for editorial featuring and asks for several
weeks of lead time. When the first version after 1.33.0 is submitted,
nominate it in App Store Connect (Apple's help page: "Nominate your app for
featuring") as a new feature: the Forest, a 3-D forest of the library that works offline, with
Ask about this book. Done only in App Store Connect; nothing in the repo.

## URLs

- Support: https://flux-frontiers.github.io/knowledge_press/support.html
- Privacy policy: https://flux-frontiers.github.io/knowledge_press/privacy.html
- Marketing (optional): https://github.com/Flux-Frontiers/knowledge_press

## Review notes (App Review Information)

App Review rejected build 725 (1.28.0) and asked for a screen recording and
written answers, and for the answers to stay in the Notes field for future
submissions. The block below is what went into Notes and the reply on
2026-10-05 (about 3,500 characters; the field holds 4,000). Paste it
unchanged unless the app has changed, and keep item 3 in step with the build
being submitted.

A reply in App Review messages does not resubmit a rejected build. On
2026-10-06 the build went back for review this way: **Edit** on the rejected
item, Notes replaced with the block below under a one-line lead, the
recording attached under Attachment, **Save**, **Update Review**, then
**Resubmit to App Review**. The lead used then:

```text
Resubmitted after the 2.1.0 rejection of October 1. The requested screen recording and answers are below and in our App Review reply of October 5; the recording is also under Attachment.
```

```text
1. Screen recording
Attached: recorded on a physical iPhone running the latest iOS, starting from launch and showing the typical flow. The app has no account registration, login or account deletion, no user-generated content shared with other users, and no paid content or in-app purchases, so none of those flows exist to show.

2. Purpose and audience
The Knowledge Press is a library of 261 public-domain books (philosophy, literature, history, science, drama, sacred texts) and four historical diaries (Samuel Pepys, John Evelyn, and Boswell's Hebrides journal), installed with the app. Readers ask a question in plain language; the app searches the whole library by meaning and by exact wording, then writes an answer only from the passages it found, and shows every source passage. It is for students, teachers, and general readers who want to explore the classics and check what the books actually say. It works offline: the books, the search index, and the language model are all on the device.

3. Setup and main features
No login, account, or sample files are needed. The library is bundled in the app; nothing is downloaded.
After a 3-second title screen, the Chat tab offers sample questions; tap one to see an answer with its sources.
- Ask: type a question on the main screen, for example "What does Marcus Aurelius say about anger?". The answer appears with its source passages; tap a passage to read it in full. This works in airplane mode.
- Browse: open Browse to see the library by genre, search by author, open any book, and read it chapter by chapter. The diaries open by date.
- Settings: choose the answer engine (On-device is the default), and tune how many passages are read.
- Siri and Shortcuts: "Ask The Knowledge Press" runs a question from Siri or the Shortcuts app.
Written answers need Apple Intelligence enabled on the device. Without it, the app still searches, browses, and reads, and says why answers are off.

4. External services
- Apple Foundation Models, on device (default answer engine). No data leaves the device.
- Apple Private Cloud Compute (optional, chosen by the user in Settings). The question and the retrieved passages go to Apple under Apple's Private Cloud Compute commitments, not to us.
- Worker (optional, off unless the user enters a server address). Sends the question to a server the user runs themselves. We operate no server, and it is not needed for review.
- Siri and Shortcuts through App Intents.
There are no accounts, analytics, advertising, crash reporting, third-party SDKs, or payment processors. The search embedder (BAAI bge-small-en-v1.5, MIT license) runs on device with Core ML.

5. Regional differences
The app's features and content are the same in every region. The only difference is Apple's: written answers use Apple Intelligence, which is available only in the regions and languages Apple supports. Where it is unavailable, the app still searches, browses, and reads the full library. The books are in English.

6. Third-party material and regulation
The app does not operate in a regulated industry. All 261 books and four diaries are public domain in the United States. The texts come from Project Gutenberg and the Internet Archive, which the app acknowledges as sources. Project Gutenberg's header and license text are removed from each book, as its license permits for public-domain works. The app is not affiliated with Project Gutenberg and does not use its trademark in the app's name or branding.
```

### The screen recording

Apple wants it on a physical device on the latest OS, starting at launch. The
2026-10-05 recording ran 2:15 on an iPhone in Airplane Mode:

1. Home Screen, Airplane Mode on in Control Center, launch the app.
2. Chat: ask "What does Marcus Aurelius say about anger?", let it finish,
   open a source passage.
3. Browse: a genre, a book, **Next** once; Pepys's diary by date.
4. Settings: the engine picker on On-device, then **Delete all
   conversations** to show the user can delete their data.

Control Center records without the microphone unless it is turned on
(long-press Screen Recording), which is why Siri is not in that recording.
Trim the ends in Photos with **Edit**, then attach the `.mov` to the reply
and under App Review Information > Attachment.

## Availability

All storefronts except China mainland. App Review held 1.28.0 (725) on
2026-10-16 under Guideline 2.1: an app with book content offered in China
mainland needs an Internet Publishing License from the National Press and
Publication Administration in the developer's name, which we do not have.
China mainland was removed under Distribution > Pricing and Availability >
App Availability, and the same build was resubmitted. The setting belongs to
the app, so later versions keep it. Hong Kong, Macau and Taiwan are separate
storefronts and stay in.

## The Mac version

Same record as iOS (Universal Purchase): name, subtitle, category, age
rating, privacy, availability and price are shared. The macOS version page
has its own text; the first one, 1.30.0 (790), was submitted 2026-10-18 with
the iOS promotional text, description, keywords and URLs above, copyright
"2026 Eric G. Suchanek, PhD", and the review notes above changed in four
places:

- A one-line lead: this is the Mac version of the same app and record, and
  the answers given for iOS apply unchanged except where noted.
- Item 1: the recording was made on an iPhone; the Mac app has the same
  features and flow.
- Items 2-4: "on the Mac" for "on the device", "click" for "tap", and
  "with networking off" for "in airplane mode". The 3-second title-screen
  line is dropped.
- Item 5: the app is not offered in China mainland.

The blocks above count the 1.32.0 corpus: 261 books plus four diaries, 265
works in all. The description and review notes are per version, so the
count changes only when a new version's text is edited.

### Mac screenshots

Apple takes 1280x800, 1440x900, 2560x1600 or 2880x1800. On a 14-inch
MacBook Pro (3024x1964), zoom the window (double-click its title bar), take
a full-screen capture with Cmd-Shift-3, and crop off the 74 px menu bar;
what is left is exactly 16:10:

```sh
ffmpeg -i in.png -vf "crop=3024:1890:0:74,scale=2880:1800:flags=lanczos" -q:v 2 out.jpg
```

Clear the Worker field in Settings first, or every answer shows "Cannot
reach the worker" and a Render button. The 1.30.0 set, in order: the start
screen with sample questions; "what did marcus aurelius say about anger?"
with Source passages open; Pepys on 1 January 1660 in the reader; *Macbeth*
I.ii in the reader.

## Category

Primary: Books. Secondary: Education.

## Age rating

13+ (questionnaire answered 2026-09-27: infrequent mature themes, sexual
content, realistic violence, weapons, profanity; nothing interactive).
