# Troubleshooting

## The tour is silent

Narration is off by default. Open settings and turn on **Read each grove
aloud on the ring**, then start the tour.

If it is on and you still hear nothing on an iPhone or iPad, check **Silent
Mode**. iOS mutes the browser's speech when the device is silenced, even
though video in another tab still plays. Open Control Center and turn Silent
Mode off, then reload the page and tap once before starting the tour.

If narration works on one device and not another, the second device is
usually silenced or has its ringer volume down. Speech follows the ringer
volume, not the media volume.

## "The book could not be fetched"

On the published site this means the download of the book's text failed;
**Try again** on the message retries it.

In a local checkout the text files are not there until you generate them.
Run `make web-books` from the repository root, which needs a `gutenberg_kg`
checkout with its packs exported. See [Book text](../BOOK_TEXT.md).

## The forest is slow

In settings:

1. Set **Leaf complexity** to **Low**.
2. Turn off **Shadows and forest floor detail**.
3. Turn off **Wind and gentle cart motion**.

**Show geometry and frame rate** tells you what you gained. On a phone the
forest starts at Low already.

## The sky is wrong for where I am

The forest asked for your location once and you refused, so it guessed a
place from your time zone. To let it use your location, allow the site in
the browser's site settings and reload. The location is rounded to 0.1
degree and never leaves the browser.

## My press is empty again

The press, the visited groves and the settings live in this browser's
storage. They are gone if you cleared the site's data, used a private window,
opened the forest in a different browser, or pressed **Reset all settings**.

## The page is blank or shows an error about WebGL

The forest needs WebGL 2. Every current browser has it, but it can be turned
off by a browser setting, an extension, or a graphics driver problem. Try
another browser; if that works, the first browser's WebGL is disabled.

## Something else

Open an issue at
[github.com/Flux-Frontiers/knowledge_press/issues](https://github.com/Flux-Frontiers/knowledge_press/issues)
with the browser, the device, and what you did. The
[support page](https://flux-frontiers.github.io/knowledge_press/support.html)
has the contact address.
