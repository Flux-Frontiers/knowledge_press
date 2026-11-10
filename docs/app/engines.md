# Answer engines

The engine is the language model that writes the answer. Pick it with the
**Engine** control: in the sidebar on iPad and Mac, and in **Settings** on
iPhone and iPad. You can change it between questions. The chat remembers
which engine wrote each answer.

| Engine | Where it runs | Needs |
| --- | --- | --- |
| On-device | This device | Apple Intelligence on |
| Private Cloud | Apple's Private Cloud Compute | Network; iOS, iPadOS or macOS 27 |
| Worker | A server you run | A worker address |
| Passages only | Nowhere: no answer is written | Nothing |

## On-device

The default. Apple's built-in model runs on the device, so nothing is sent
anywhere and it works in airplane mode.

Its limit is size. It reads about 4,000 tokens at once, which is a handful of
passages, so its answers are shorter and plainer than the other engines'.
Narrowing the [scope](asking.md#choose-where-to-search) helps it most.

If Apple Intelligence is off, or the model is not ready, the chat says so in
the line under the title, and each answer area gives the reason. The search
and the passages still work.

## Private Cloud

Apple's larger model, on Apple's Private Cloud Compute servers. It reads about
32,000 tokens, eight times as much, so it gets about twelve passages and
writes better prose. Your question and the chosen passages go to Apple under
Apple's privacy guarantees. They do not go to us.

Two costs:

- It needs a network connection.
- It draws on your iCloud allowance. When you near the limit, the engine
  settings show a usage line and a **Show usage options** button that opens
  Apple's own sheet.

Apple's content filter can stop a Private Cloud answer partway, and no setting
turns it off. See [Troubleshooting](troubleshooting.md#an-answer-stops-partway).

## Worker

A server you run yourself, such as a Mac with a large model on it. Set its
address under **Worker** in Settings. Then pick the provider (oMLX,
Ollama, OpenAI or Anthropic) and a model. The app has no default worker and
contacts none until you enter one. It is also the only engine that can draw
illustrations.

### Install a worker

The worker is [GutenbergKG](https://github.com/Flux-Frontiers/gutenberg_kg),
the project that builds this corpus. It runs in Docker on a Mac, Linux or
Windows machine.

1. Install [Docker](https://docs.docker.com/get-docker/).
2. Clone the project and fetch the published image:

    ```sh
    git clone https://github.com/Flux-Frontiers/gutenberg_kg
    cd gutenberg_kg
    make pull-worker-image
    ```

3. Start the worker on port 8000 with `make run`. To get the chat page and an
   image server as well, which illustrations need, use `make up`.
4. Give the worker a model to call: oMLX, Ollama, OpenAI or Anthropic. See
   [Connecting a local LLM](https://flux-frontiers.github.io/gutenberg_kg/INSTALLATION/#connecting-a-local-llm-optional).
5. To reach it from an iPhone or iPad, set `WORKER_BIND=0.0.0.0` in
   `docker/.env`, restart the worker, and enter
   `http://<your-mac>.local:8000` under **Worker** in Settings. See
   [Serving phones and other devices on your LAN](https://flux-frontiers.github.io/gutenberg_kg/INSTALLATION/#serving-phones-and-other-devices-on-your-lan).

The [GutenbergKG installation guide](https://flux-frontiers.github.io/gutenberg_kg/INSTALLATION/)
has the full steps, including building the image yourself.

## Passages only

No answer is written. You get the search results to read yourself, which is
faster and has no model's interpretation in it. It suits a question where you
want the text, not a summary of it.

## In-app help

**Settings**, then **Help**, explains these engines and every setting in the
app, in the app. On a Mac, the Help menu has **The Knowledge Press Help**.
The question-mark button beside the Search, Answers, Worker, Synthesis and
Illustrations headings in Settings opens the matching page.
