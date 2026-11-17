---
name: build
description: >
  Build, test and install every Knowledge Press target: the web forest, the
  Swift package tests, the iPhone/iPad app on a device or Simulator, the Mac
  dev app, and the App Store archives for both. Use when asked to build,
  install, deploy, put a build on an iPad/iPhone/Mac, run the app, run the
  tests, stage the forest or corpus, or archive for the App Store. For cutting
  a version and tagging, use the release skill instead.
---

# Building the Knowledge Press

Everything goes through the `Makefile` at the repo root; its header lists
every target. `app/RUNBOOK.md` is the long reference (sections 6 to 8 for the
apps). This file is the short path and the traps.

## 0. Before any build

Several sessions share this repo, and Eric uploads to Apple from it.

1. **Never build in, or switch the branch of, the main checkout**
   (`~/repos/knowledge_press`). Work in your own worktree:

   ```bash
   git fetch origin
   git worktree add ../kp-<topic> -b <branch> origin/develop   # feature work
   git worktree add --detach ../kp-<topic> origin/develop      # build only
   ```

   Feature branches come off `develop` and PR back into `develop`, never
   `main`.
2. **Check nothing else is building or uploading**:
   `ps -ax -o pid,etime,command | rg '[x]codebuild|[a]ltool|make (ios|mac)'`.
   A `log stream ... altool` line is only a log watcher.
3. **Give the worktree the web dependencies.** The `ios-build`, `mac-dev`
   and archive targets stage the web forest, which needs `web/node_modules`.
   Link the main checkout's copy rather than reinstalling:

   ```bash
   ln -s ../../knowledge_press/web/node_modules web/node_modules
   ```

   The link is untracked, and `.gitignore`'s `node_modules/` rule does not
   cover a symlink, so stage files by path (`git add web/src web/tests ...`),
   never `git add -A`. Remove the link before you finish:
   `rm web/node_modules`. The pre-commit web hooks need it, so keep it until
   after the commit.
4. **The corpus** comes from a sibling `gutenberg_kg` checkout
   (`GUTENBERG_KG_DIR`, default `../gutenberg_kg`, which resolves from any
   sibling worktree). Its `bundles/gutenberg-all/swift` must hold a
   `manifest.json`; if not, run `make export-swift` there first.

## 1. Tests and checks (no device needed)

| What | Command (from the worktree root) |
| --- | --- |
| Web tests | `cd web && npm test` |
| Web typecheck | `cd web && npx tsc --noEmit` |
| Web production build | `make web-build` (writes `web/dist`, including `version.json`) |
| Swift package tests | `cd app/GutenbergKGKit && swift test` |
| iOS compile, unsigned | `make ios-check` |
| Mac compile, unsigned | `make mac-check` (the CI gate) |
| Version sites agree | `python3 scripts/check_version.py` |
| User guide | `make docs` (needs `make docs-install` once) |

Run the web tests and typecheck after any `web/` change, and `swift test`
after any `app/` change, before installing anything.

## 2. iPhone / iPad on a real device

```bash
make ios-devices                      # names, UDIDs, availability
make ios-build                        # signed Debug build, forest staged
xcrun devicectl device install app --device <UDID> \
  app/ios/build/Build/Products/Debug-iphoneos/KnowledgePress.app
xcrun devicectl device process launch --device <UDID> \
  --terminate-existing com.fluxfrontiers.knowledgepress
```

- **Address devices by UDID**, not by name: two devices have shared a name.
  The current test iPads are in memory (`ipad-devices`); confirm with
  `make ios-devices`.
- `ios-build` restages `app/ios/Forest` from `web/` every time, so a web
  change reaches the device with no extra step. It does not install.
- **`devicectl` drops Wi-Fi connections.** "Connection reset by peer" or
  "Connection was invalidated" usually clears on a plain retry of the same
  command. Check `make ios-devices` shows the device `available` first.
- **The corpus is separate** and rarely needs pushing: the device keeps it
  across app installs. Push it only after a new `export-swift`, or to a new
  device: `make ios-deploy IOS_DEVICE=<UDID>` (about 690 MB; USB is more
  reliable than Wi-Fi).
- Every reachable device at once: `make ios-deploy-all` (app only) or
  `make ios-push-all` (app and corpus).
- A new device needs Developer Mode on, then one `xcodebuild ...
  -allowProvisioningDeviceRegistration` build to join the profile
  (RUNBOOK section 6).
- Confirm what you installed:
  `/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' -c 'Print CFBundleVersion' app/ios/build/Build/Products/Debug-iphoneos/KnowledgePress.app/Info.plist`.
  The build number is the commit count plus `APP_BUILD_OFFSET` (498).

## 3. Simulator (screenshots)

`make ios-sim SIM="iPad Pro 13-inch (M5)"`, then `make ios-sim-screenshot`;
`make ios-sim-kill` when done. Default `SIM` is `iPhone 17 Pro Max`.

## 4. The Mac app

```bash
make mac-dev        # Debug .app, corpus and forest staged, automatic signing
open app/macos/build/Build/Products/Debug/KnowledgePress.app   # or make mac-dev-run
```

- **Check for a running copy first**:
  `pgrep -fl 'KnowledgePress.app/Contents/MacOS'`. Another session's dev
  build, or the App Store copy, may be open. Don't quit someone else's; ask
  Eric. A second instance shares the same data containers.
- `mac-dev` copies the 743 MB corpus into `app/macos/Corpus` each time.
- `swift run KnowledgePress` from `app/GutenbergKGKit` is the fast loop for
  the SwiftUI shell. It has no Info.plist, so version-dependent features
  (the What's New sheet) stay off.

## 5. App Store archives (Eric uploads)

Eric does the uploads. Prepare archives only when asked, and never at a moving
branch:

```bash
git worktree add --detach ../kp-release-X.Y.Z vX.Y.Z
cd ../kp-release-X.Y.Z && ln -s ../../knowledge_press/web/node_modules web/node_modules
make ios-archive GUTENBERG_KG_DIR=/Users/egs/repos/gutenberg_kg
make mac-archive GUTENBERG_KG_DIR=/Users/egs/repos/gutenberg_kg
# read the version and build from each archive before anything is uploaded:
/usr/libexec/PlistBuddy -c 'Print ApplicationProperties:CFBundleShortVersionString' \
  -c 'Print ApplicationProperties:CFBundleVersion' app/ios/build/KnowledgePress.xcarchive/Info.plist
```

`make -o ios-archive ios-upload` (and the `mac-` pair) exports and uploads
an existing archive. When the release worktree is no longer needed, move its
archives into `~/Library/Developer/Xcode/Archives/<date>/` first (they are
needed to symbolicate crashes from that build), then
`git worktree remove --force`.

## 6. The web forest in a browser

- `make web-dev` serves on port 5173, `--host` for the LAN. `make web-kill`
  stops every Vite server.
- Headless checks: `puppeteer-core` is in `web/node_modules` and Chrome is
  at `/Applications/Google Chrome.app`. Use `--use-angle=swiftshader`. In the
  dev server, `await import("/src/game/store.ts")` inside `page.evaluate`
  returns the live store, so a test can drive state directly. A script that
  imports `puppeteer-core` must run from inside `web/` to resolve it.
- Shot and gallery scripts: `web/scripts/gallery.mjs`.

## 7. Shell traps here

- The shell is bash 3.2: no heredoc inside `$(...)`. Pass commit and PR
  bodies on stdin (`git commit -F - <<'EOF'`, `gh pr create --body-file -`).
- Use `rg`, not `grep`.
- Keep build logs in the session scratchpad, not the repo, and grep them for
  `BUILD SUCCEEDED` / `error:` instead of printing them.

## 8. Report

Say what was built, from which commit (`git log -1 --format=%h`), the
version and build number, and where it was installed (device name and UDID).
Name anything skipped, such as the corpus push or a device that was offline.
