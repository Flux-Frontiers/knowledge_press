# Release Notes -- v1.34.1

> Released: 2026-11-05

### Fixed

- **"Ask The Knowledge Press" works with Siri.** The Siri phrases were
  declared in the shared package, and Xcode registers App Shortcuts only
  from the app's own module, so no build since the shortcut was added
  offered it to Siri or listed it under App Shortcuts; only the bare action
  appeared in the Shortcuts editor. The phrases now live in the app target,
  on iPhone, iPad and Mac. The intent also started with its question set to
  an empty string, which counted as answered, so Siri never asked "What do
  you want to ask?" and the app dropped the empty question. It now starts
  unset, and Siri asks. When Siri launched the app from closed, the
  question also arrived before the app had opened its on-device corpus and
  failed with "Could not connect to the server"; it now waits for the
  corpus to open.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
