# Release Notes -- v1.28.1

> Released: 2026-09-29

### Fixed

- **Render is only offered when the worker can draw.** The button was always
  enabled, but rendering goes through the worker, which most readers do not
  have. It is now hidden when no worker address is set, and disabled with a
  reason and a Retry button when the worker is unreachable or reports no
  image backend. The check runs at launch, when the app returns to the
  foreground, when the address changes, and after a render fails on the
  network. It waits 5 seconds, not 60. A worker too old to report image
  backends keeps Render enabled.
- **The iPhone and iPad app lists all four orientations.** The iOS target
  declared Portrait, Landscape Left and Landscape Right and left out
  Portrait Upside Down, which iPad multitasking requires. App Store Connect
  rejected the first delivery of 1.28.0 (build 720) with error 90474 until
  it was added.
- **The privacy manifests are well-formed XML.** A comment in
  `PrivacyInfo.xcprivacy` contained a double hyphen, which XML forbids;
  `plutil` accepted it, but App Store Connect rejected build 720 with
  ITMS-91056. The comments are gone from the iOS and macOS manifests, and a
  pre-commit hook, `scripts/check_privacy_manifest.py`, now parses both
  strictly.

---

_Full changelog: [CHANGELOG.md](CHANGELOG.md)_
