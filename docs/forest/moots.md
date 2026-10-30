# Moots

A moot is two books talking about a topic. Each book speaks only from passages
of its own text, in its author's voice, and answers what the other has just
said. You can play saved moots in the forest; the trees that are talking light
up while they speak.

A moot is written by a language model, not by the authors. The model is given
each book's passages and writes its turns from them. Every quotation in a moot
is checked against the book: a quote that is not the book's exact words is
corrected to them or loses its quotation marks.

## Play a moot

1. Open **Moots**: the speech-bubbles button in the top bar, or **Moots** in
   the three-dot menu (on a phone, only the menu has it).
2. Pick a moot from the list. Each shows its two books and topic, for
   example *Meditations and The Prince on virtue*, the date it was held, and
   how many turns it has.

The moot plays on its own. Each turn appears as a speech bubble: the first
book on the left in green, the second on the right in pink. Book names are in
their colors, quoted words are in bold, and the passages a turn cites are
listed under its bubble. In the forest, the tree that is speaking is ringed in
its color.

| Control | What it does |
| --- | --- |
| **Pause** / **Play** | Stops and resumes the moot. At the end, **Play again** starts it over. |
| Speaker button | Turns reading aloud on or off. It is the same switch as **Read moots aloud** in settings. |
| **Next** | Shows the next turn now. |
| Close (X), ++esc++, or a click outside the moot | Closes the moot. |

Switching away from the browser pauses the moot.

## Hold a new moot

You can also hold a moot of your own and watch it being made. This needs a
GutenbergKG worker running on your computer, with a language model behind
it; the [GutenbergKG Moots guide](https://flux-frontiers.github.io/gutenberg_kg/MOOTS/#live-moots-from-the-forest)
covers the setup.

1. In **Moots**, choose **Hold a new moot**.
2. Type in **First book** and **Second book** and pick each from the list.
3. Give a **Topic**, choose how many **Turns**, and choose **Start the moot**.

The worker makes one turn at a time. While it does, the next book is ringed
in the forest and its name shows "is thinking...". A turn takes from a few
seconds to half a minute, depending on the model; the worker makes the next
turn while the current one is read, so after the first the wait is usually
short. Closing the moot ends it on the worker. If a turn fails, choose
**Try again**.

Which forest you use matters:

| Forest | Chrome | Safari |
| --- | --- | --- |
| The forest's dev server on your computer (`http://localhost:5173`) | works | works |
| The published forest | works after you allow access to your local network when Chrome asks | does not work: Safari will not let a secure page reach your computer |

The worker's address is set in [Settings](settings.md#live-moots).

From a phone or iPad on your network, open the dev server as
`http://<your-mac>.local:5173` (see [Book text](../BOOK_TEXT.md)) and set the
worker's address to `http://<your-mac>.local:8000`. The worker must listen on
the network and allow that forest as an origin: `WORKER_BIND=0.0.0.0` and
`GUTENKG_CORS_ORIGINS=http://localhost:5173,http://<your-mac>.local:5173,https://flux-frontiers.github.io`
in the worker's `docker/.env`, as GutenbergKG's installation guide describes.

## Reading aloud

Moots are read aloud by default, one turn after another; the next turn starts
when a line ends. With reading aloud off, each turn stays up for about a
second for every three words, and at least four seconds.

Each book speaks in a voice that matches its author: a woman's book in a
woman's voice, and an American, British or other English accent where the
browser has one. When both books need the same voice, the second speaks
deeper. To pick the voices yourself, see [Settings](settings.md#sound-and-cards).

Which voices you hear depends on the browser:

- **Safari** offers web pages only its six built-in English voices, not the
  voices you download in macOS settings.
- **Chrome** lists every macOS voice, including ones that are not installed;
  a voice that is not installed speaks in the default voice instead. The
  forest prefers voices that are always present.
- Neither Safari nor Chrome has a built-in American man's voice, so an
  American author may be read with a British accent.

If nothing is read aloud, the device may be silenced; see
[Troubleshooting](troubleshooting.md).

## Where moots come from

Moots are held with GutenbergKG, which built the library, and saved into the
forest. [Moots](https://flux-frontiers.github.io/gutenberg_kg/MOOTS/) in the
GutenbergKG guide explains how a moot is made and how to hold your own.
