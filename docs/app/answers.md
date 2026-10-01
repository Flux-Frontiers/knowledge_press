# Reading an answer

An answer has four parts, from top to bottom.

## The answer

The answer streams in as it is written, with a cursor at the end. Under it,
a small line names the model that wrote it. For on-device answers it begins
with an **on-device** tag. You can select and copy the text.

The answer is written only from the passages the search found. If they do not
support an answer, the model says so.

## The caption

A line of figures sits under the answer, for example:

> 📊 12 passages · 2 KGs queried · search 41 ms · synthesis 3,200 ms · 5 of 12 in context

| Part | Meaning |
| --- | --- |
| passages | How many passages the search returned. |
| KGs queried | How many indexes it searched: the books, the diaries, or both. |
| search | How long the search took. |
| synthesis | How long the answer took to write. |
| N of M in context | How many of the passages fit in the model's reading window. The rest were found but did not reach the model. |

## Source passages

**Source passages** lists everything the search found, best first. It is
folded away under an answer, and open when there is no answer to read.

Each passage shows the genre, the kind of text, the book and author, the
beginning of the text, and a bar for how well it matched. Diary passages show
their date. **Show full passage** expands a long one.

A passage the model actually read carries a green **in context** tag. When an
answer seems to ignore something you know is in the book, look here first: if
the passage you expected is not marked, the model never saw it. Try different
wording, or narrow the scope.

## Render

Under some answers there is a **Render** button, which asks your own worker
server to draw an illustration of the answer. It appears only when a worker is
set up and reachable. See [Settings](settings.md#illustrations) and
[Troubleshooting](troubleshooting.md#render-is-missing-or-greyed-out).

## When there is no answer

The app tells you why in the answer area, and the passages stay below, where
you can read them. See [Troubleshooting](troubleshooting.md).
