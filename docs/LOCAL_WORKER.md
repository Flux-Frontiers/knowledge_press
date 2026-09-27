# Reading books in the forest: a local worker

The Knowledge Press Forest shows each book as a tree. **Open the book** on a
tree's card shows the book's text, which comes from the GutenbergKG worker in
[gutenberg_kg](https://github.com/Flux-Frontiers/gutenberg_kg). The published
site on GitHub Pages cannot reach a worker, so to read books you run both
pieces on your own machine:

- the worker, in a container, on `http://localhost:8000`;
- the forest, from the Vite dev or preview server, which forwards `/worker`
  requests to the worker.

Any browser that can reach that Vite server can read, including a phone or
iPad on the same network.

## Before you start

- A `gutenberg_kg` checkout. The steps below assume it sits next to this
  repository (`~/repos/gutenberg_kg` beside `~/repos/knowledge_press`).
- Docker Desktop, or Apple's `container` runtime. The Makefile uses Docker by
  default; add `RUNTIME=apple` to each `make` command for Apple's.
- Node.js 20 or later (CI builds with 22).
- For building the worker image yourself: the corpus bundle at
  `gutenberg_kg/bundles/gutenberg-all`, about 5 GB. If you don't have it, pull
  the published image instead (step 1).

## 1. Start the worker

In `gutenberg_kg`, on `main`, build the image and start the worker:

```bash
cd ~/repos/gutenberg_kg
make build
make run
```

`make run` starts only the worker, which is all the forest needs. `make up`
starts the worker together with the Streamlit chat and the image server.

To skip the build, pull the published image, then start it the same way:

```bash
make pull-worker-image
make run
```

The published image is only as new as its last `make publish-worker-image`. If
it predates a worker fix you need (for example, diaries opening in the reader),
build locally instead.

Check that the worker answers:

```bash
curl -s -X POST http://localhost:8000/runsync \
  -H 'Content-Type: application/json' \
  -d '{"input": {"op": "list_genres"}}'
```

The reply is a JSON object whose `output.genres` lists every genre with its
book count.

## 2. Start the forest

In this repository:

```bash
cd ~/repos/knowledge_press/web
npm install
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`, and click
**Start driving**. `npm run dev` also listens on your network address, so other
devices can load the forest (see
[Reading from a phone or iPad](#reading-from-a-phone-or-ipad)).

`npm run preview` serves the production build, with the same proxy, and is the
better place to judge the frame rate. Run `npm run build` first.

## 3. Open a book

1. Drive up to a tree and slow down until its card appears, or click the tree
   to pin its card.
2. Click **Open the book**. Books you have read into the press also have an
   **Open** link in the press (**L**).
3. Pick a chapter from the list, or use **Previous** and **Next**. A diary's
   chapters are its dated entries.
4. Press **Esc** or the close button to return to the forest. Driving and the
   keyboard shortcuts pause while a book is open.

## Reading from a phone or iPad

The Vite server runs on your Mac and forwards `/worker` to the Mac's own
`localhost:8000`, so a phone or iPad only needs to reach the Vite server, not
the worker.

1. Put the device on the same network as the Mac.
2. On the device, open `http://<your-mac>.local:5173`. The **Network** line
   that `npm run dev` prints shows the Mac's address.

On an iPad with a keyboard, if the Left and Right arrows don't look around and
a blue box appears when you press them, turn off **Full Keyboard Access** in
**Settings > Accessibility > Keyboards & Typing** (on some versions,
**Keyboards**). It takes the arrow keys for itself.

## Using a worker on another machine

Set `WORKER_URL` when you start the forest:

```bash
WORKER_URL=http://studio.local:8000 npm run dev
```

The worker only has to be reachable from the machine running Vite.

## Updating the worker

After changes to the worker in `gutenberg_kg`, rebuild the image and restart
the worker:

```bash
cd ~/repos/gutenberg_kg
git checkout main && git pull
make down
make build
make run
```

Stop the old worker first. Under `RUNTIME=apple`, `make run` does nothing when a
worker is already running, so the old image keeps serving.

## How the pieces connect

```
browser (Mac, phone or iPad)
  -> POST /worker/runsync            same origin as the page
Vite dev or preview server           web/vite.config.ts
  -> POST http://localhost:8000/runsync   (WORKER_URL overrides)
worker container                     gutenberg_kg serve/handler.py
  -> a book's text from the consolidated DocKG, a diary's from its DiaryKG
```

The forest asks for a book by genre and by its catalog `book` key, the book's
folder name in the corpus. `web/src/game/worker.ts` sends two requests:
`get_chapters` for the chapter list and `get_chapter` for one chapter's text.
Because the browser only talks to the page's own server, the worker does not
need to send CORS headers.

## Troubleshooting

**The reader says the book could not be fetched.**
Check that the worker answers the `curl` command in step 1. Check that you
opened the forest from `npm run dev` or `npm run preview`, not from GitHub
Pages or a file opened directly.

**Books open but diaries answer "book not found".**
The worker image predates the fix that lets the worker read diaries. Build it
from current `main` and restart it (see
[Updating the worker](#updating-the-worker)).

**The phone or iPad can't load the forest.**
Use the Mac's `.local` name or network address, not `localhost`, which on the
device means the device itself. Check that both are on the same network and
that the Mac's firewall allows incoming connections for Node.

**Port 5173 is already in use.**
Vite moves to the next free port and prints it. `make web-kill` in this
repository stops every running Vite server.
