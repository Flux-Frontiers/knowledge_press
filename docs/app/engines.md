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
address under **Worker** in Settings. Then pick the provider (oMLX, Ollama
or OpenAI) and a model. The app has no default worker and contacts none
until you enter one. It is also the only engine that can draw illustrations.

## Passages only

No answer is written. You get the search results to read yourself, which is
faster and has no model's interpretation in it. It suits a question where you
want the text, not a summary of it.

## In-app help

**Settings**, then **Help**, explains these engines and every setting in the
app, in the app. On a Mac, the Help menu has **The Knowledge Press Help**.
The question-mark button beside the Search, Answers and Synthesis headings in
Settings opens the matching page.
