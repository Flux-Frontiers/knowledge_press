# Troubleshooting

## An answer stops partway

The answer area says "The content guardrail stopped the answer partway."
Apple's content filter watches an answer as it is written and can halt it.
What had been written stays; the rest does not arrive. It is not about your
question: the filter stops scripture at the destruction of a city, and a diary
of the Great Fire at the point where it records who was blamed.

Try, in this order:

1. Tap **Ask again**. The filter is inconsistent, and often lets the same
   question through the second time.
2. Switch the **Engine** to **On-device**, and turn on **Permissive guardrails**
   under Synthesis. Private Cloud has no setting that prevents this.
3. Read the passages under the answer. They are never filtered.

## "The model declined to answer"

The filter rejected the passages before any writing began. The same three
steps apply.

## "No passage carried enough text to answer from"

The search found nothing usable. Try different wording, lower **Min score** in
Settings, or widen the **Scope** to **all**.

## "No passages matched"

Same remedies as above. A scope of one small genre, such as the diaries, gives
few matches for a question about something else.

## "On-device answers are unavailable"

Apple Intelligence is off, or the model is not ready. The reason follows the
dash. On a Mac, turn Apple Intelligence on in System Settings. On an iPhone or
iPad, in Settings under Apple Intelligence and Siri. Until then, switch the
engine to **Passages only** or to Private Cloud if your device has it.

## "The passages did not fit the on-device context window"

Lower **Results** or **Passages per work** and ask again.

## An answer that repeats itself

Usually several passages from one book, with the model echoing them. Lower
**Passages per work**, or raise **Temperature** a little if it is at zero.

## Answers that ignore a book you know is there

Open **Source passages** and look for the **in context** tags. If the passage
you expected is not marked, the model never read it. Narrow the scope to the
genre, or word the question more like the text.

## Render is missing or greyed out

**Render** draws an illustration on a worker you run, so it is hidden until a
worker address is set under **Settings**, then **Worker**. If an address is set
and Render is greyed out, a line beside it says why: the worker cannot be
reached, or it has no image source running. Tap **Retry** to check again. The
app also checks when you open it, when you return to it, and when you change
the address.

## The Browse list is empty

With the corpus installed on the device, Browse needs nothing else. If it says
"No genres yet", the corpus did not open: the Corpus section of Settings shows
the reason. Without an installed corpus, Browse reads from a worker, and shows
the connection error.

## Still stuck

Open an issue at
[github.com/Flux-Frontiers/knowledge_press/issues](https://github.com/Flux-Frontiers/knowledge_press/issues)
with your device, the iOS or macOS version, and what you did. The
[support page](https://flux-frontiers.github.io/knowledge_press/support.html)
has the contact address.
