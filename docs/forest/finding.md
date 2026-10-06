# Finding books

There are 253 books in the forest. These are the ways to reach one.

## Light the groves with a query

Type a word in the **lantern query** field at the top left: `stoic`,
`freedom`, `fire`, `sea`. Every tree whose title, tags or excerpt matches
lights up, and a **lantern trail** on the ground leads from the cart to the
nearest one. Press ++enter++ to jump straight to the first match.

The trail clears when you arrive. The clear button in the field, or an empty
field, puts the lanterns out.

## Jump to a grove

++g++, or **Browse** in the top bar and then the **Groves** tab, lists every
grove with its mark, its species and how many trees it holds, and every
exhibit. Pick one to jump there. Groves you have visited are marked.

On the minimap, tap a grove's dot to list its books, or tap an exhibit's gold
diamond to jump to it.

## Browse every book

++b++, or **Browse** in the top bar, opens the **Books** tab: the whole
catalog grouped by grove, with each grove's mark and species at the top of
its section. Type in the filter to narrow it by title, author or genre.
Press ++enter++ to jump to the first book shown, or **Jump** beside any book.

From a grove's signpost, or a grove's dot on the minimap, the same list opens
showing that grove alone, with **Go to the grove** at the top.

## From the redwood

The corpus redwood at the hub has one limb per book, reaching toward that
book's tree. Its plaque lists every book in the corpus; tap the plaque to
read it, and pick a book to jump to it.

## From the press

The press (++l++) lists the books you have read. Each entry jumps to its
tree or opens the book.

## Link to a tree

Add `?tree=` and a book's slug to the forest's address, and the drive starts
beside that book's tree, with its card open and a lantern trail pointing at
it, instead of at home. The slug is the book's name in the catalog, usually its
title in lower case with underscores, such as `moby_dick`. For example:

```
https://flux-frontiers.github.io/knowledge_press/?tree=hamlet
```

The start screen says which tree it will open beside. A slug the forest does
not know is ignored, and you start at home as usual. The book gallery links
every book it shows this way.
