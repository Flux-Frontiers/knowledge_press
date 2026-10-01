# Settings

Open **Settings** from the toolbar on iPhone (the sliders button), from the
bottom of the sidebar on iPad, or with ++cmd+comma++ on a Mac. Changes apply to
your next question. The app remembers them.

Beside the Search, Answers and Synthesis headings is a question-mark button
that opens the matching page of the in-app Help.

## Corpus

**Scope** limits what a question searches. See
[Choose where to search](asking.md#choose-where-to-search). On Mac and iPad it
is in the sidebar as well.

## Search

| Setting | What it does |
| --- | --- |
| Results | How many passages the search returns, 1 to 50. The model reads as many as fit, best first. More results give you more to read under the answer, not a longer answer. |
| Min score | Discards matches weaker than this, 0 to 0.9. Raise it when answers draw on passages that only share a word with your question. Lower it when a search comes back empty. |
| Semantic floor | The least meaning-based similarity that a match found by exact wording must also have, 0 to 0.9. It stops a shared rare word from being enough on its own. |

**Reset search to defaults** puts all three back.

## Answers

**Engine** picks who writes the answer; see [Answer engines](engines.md).

## Synthesis

These shape how the model writes. They apply from the next answer.

| Setting | What it does |
| --- | --- |
| Temperature | How much the model varies its wording, 0 to 1. The default is 0.2: low, but not zero, because at exactly zero these models can loop and repeat a phrase. Above about 0.5, answers drift from the passages. |
| Greedy decoding | Always takes the most likely next word, the same as temperature 0. It greys out the temperature slider. Use it to compare two other settings fairly. |
| Instructions | **Guide**, the default, is written for the small on-device model and asks for two or three paragraphs. **Worker parity** is the wording written for the large model on a server, and gives very short answers on the on-device model. |
| Passages per work | How many passages from one book may appear in one answer. **Engine default** is 2 for on-device and 4 for Private Cloud. Raise it for depth in one book, lower it for variety. |
| Permissive guardrails | On-device only. Relaxes Apple's content check on your question and the answer, which classic literature trips more than you would expect. It does not turn safety off. |

**Reset synthesis to defaults** puts all of them back.

## Illustrations

**Resolution** and **Backend** set the size and source of an illustration that
**Render** draws. Illustrations always come from a worker you run; the app
cannot draw them on its own. The three resolutions are Preview (768 × 512),
Standard (1152 × 768) and Full (1536 × 1024). A smaller one renders faster.
**Backend** lists only the image sources the worker reports as ready now.

## Delete all conversations

Removes every saved chat, including their answers and illustrations. It asks
first and cannot be undone.

## Corpus information

Shows where the books are kept. With the corpus installed, it reads
"on this device" and lists the vector format, the embedding model, and the
size. **Search and answers both run here. Airplane mode changes nothing.**
appears when you are on the on-device engine.

## Worker

The address of a server you run. Type it and tap **Test**. The app reports the
number of books and genres it found, or why it could not reach it. On an
iPhone or iPad, `localhost` means the device itself, so use your Mac's name or
address instead. See [Answer engines](engines.md#worker).

## Help and About

**Help** opens the in-app Help. **About** (on iPhone and iPad; on a Mac it is
in the app menu) shows the version and the corpus counts.
