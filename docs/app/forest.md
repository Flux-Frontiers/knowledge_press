# The forest in the app

The app carries the same 3-D forest as the
[web site](https://flux-frontiers.github.io/knowledge_press/), one tree for
each book. In the app it works without a network connection, and every
book's text is read from the corpus already on your device.

Open it from the **Forest** tab on iPhone, or **The forest** in the
sidebar on iPad and Mac. Driving, the tour, reading and the press work as
the [forest guide](../forest/getting-started.md) describes.

## From a book to its tree

A **Tree** button appears beside each book in **Browse** and on each
citation card in an answer. Tap it and the forest opens beside that book's
tree, with its card showing. If the forest is already open, the cart moves
there without starting over.

## From a tree to a question

In the app, a tree's card has an **Ask about this book** button. It starts a
new chat scoped to that book alone, with *In <book>,* already typed in
the question box. Finish the question and send it.

The scope picker shows the book as `<genre>/<book>`, and every passage in
the answer comes from it. Pick another scope there to widen the question to
the genre or the whole corpus.

## What stays where

The press, your settings and the groves you have visited are kept by the
app's forest, separately from the web site's. Clearing one does not clear
the other.

**Use my location**, for true sunrise and sunset, asks the system for
permission the first time. The location is used only to place the sun, moon
and stars, and is never sent anywhere.

## If the tab is empty

A build made without the forest staged shows **The forest is not staged**.
App Store builds always carry it, so you will only see this in a
development build: run `make ios-stage-forest` or `make mac-stage-forest` in the repository and build again.
