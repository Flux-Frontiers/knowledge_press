# The Knowledge Press

The Knowledge Press reads a [GutenbergKG](https://flux-frontiers.github.io/gutenberg_kg/)
corpus of public-domain books in two ways:

- **The Knowledge Press Forest**, a web app at
  [flux-frontiers.github.io/knowledge_press](https://flux-frontiers.github.io/knowledge_press/).
  Every book in the corpus grows as a tree, and you drive a lantern cart
  through the groves, read the books from their trees, and collect them in
  your press. The [Forest guide](forest/getting-started.md) covers it.
- **The Knowledge Press app** for iPhone, iPad and Mac, which searches the
  same corpus on the device and answers questions from it. [Inside the
  app](APP_INTERNALS.md) describes how it is built.

Both read the packs that `gutenkg export-swift` writes. The corpus, the
ingestion pipeline and the on-device pack format are documented on the
[GutenbergKG site](https://flux-frontiers.github.io/gutenberg_kg/).

## Where to start

| You want to | Read |
| --- | --- |
| Play the forest for the first time | [Getting started](forest/getting-started.md) |
| Know what the trees, groves and roads mean | [The forest](forest/the-forest.md) |
| Find a particular book | [Finding books](forest/finding.md) |
| Hear the guided tour on an iPad | [Troubleshooting](forest/troubleshooting.md#the-tour-is-silent) |
| Read books in a local checkout | [Book text](BOOK_TEXT.md) |

The source is at
[github.com/Flux-Frontiers/knowledge_press](https://github.com/Flux-Frontiers/knowledge_press).
The forest is licensed under the Elastic License 2.0; the app is proprietary.
