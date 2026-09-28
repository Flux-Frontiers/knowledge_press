# The Knowledge Press: the iOS / macOS app (app/) and the web forest (web/).
#
# Author: Eric G. Suchanek, PhD -- Flux-Frontiers, Liberty TWP, OH
# Copyright (c) 2026 Eric G. Suchanek, PhD. Elastic License 2.0; see LICENSE.
#
# Both read a corpus that gutenberg_kg builds; nothing here builds one. Point
# GUTENBERG_KG_DIR at a gutenberg_kg checkout (default: a sibling directory)
# and run `make export-swift` there first. See app/RUNBOOK.md.
#
# The iPhone app (app/ios) -- see app/RUNBOOK.md section 6:
#   make ios-devices        -- list connected iPhones and their identifiers
#   make ios-generate       -- regenerate KnowledgePress.xcodeproj from project.yml
#   make ios-check          -- compile for arm64 device, unsigned; no phone needed
#   make ios-install-corpus -- push the corpus packs into the app's container
#   make ios-verify-corpus  -- list what is actually in that container
#   make ios-launch         -- relaunch the app so it re-reads the corpus
#   make ios-deploy         -- install-corpus + verify + launch, in order
#   make ios-build          -- signed device build (needs a Team ID on this Mac)
#   make ios-deploy-all     -- install + relaunch the app on every reachable device
#   make ios-push-all       -- build, then install app + corpus + relaunch on every reachable device
#
# All the ios-* targets auto-detect a reachable device. With more than one
# paired, name it: make ios-deploy IOS_DEVICE=<udid|name>
#
# The Mac app (app/macos) -- see app/RUNBOOK.md section 7:
#   make mac-generate  -- regenerate KnowledgePress.xcodeproj from project.yml
#   make mac-check     -- compile unsigned; no certificate needed (the CI gate)
#   make mac-stage-corpus   -- copy the corpus packs into app/macos/Corpus
#   make mac-unstage-corpus -- empty app/macos/Corpus again
#   make mac-build     -- Release .app, corpus bundled, Developer ID signed
#   make mac-verify    -- prove the signature is distributable before shipping
#   make mac-notarize  -- submit the .app to Apple, wait, staple the ticket
#   make mac-dmg       -- package the stapled .app as a signed .dmg
#   make mac-archive   -- sandboxed Release .xcarchive for the Mac App Store
#   make mac-upload    -- export the archive as a .pkg and send it to App Store Connect
#
# The web forest (web/):
#   make web-install   -- npm install
#   make web-dev       -- Vite dev server on port 5173
#   make web-test      -- the node test suite
#   make web-build     -- typecheck and production build
#   make web-preview   -- production build, served on the LAN like web-dev
#   make web-kill      -- stop every running Vite dev or preview server
#   make web-books     -- write each book's text into web/public/books (gutenberg_kg)
#   make web-books-publish -- upload that text for the Pages build, then redeploy
#
# The app icon (app/icon):
#   make icons         -- re-render every icon PNG from the press-seal SVGs

GUTENBERG_KG_DIR ?= ../gutenberg_kg

.PHONY: icons ios-devices ios-generate ios-check ios-install-corpus ios-verify-corpus ios-launch ios-deploy ios-sim-build ios-sim-boot ios-sim-install-corpus ios-sim-launch ios-sim ios-sim-screenshot ios-deploy-all ios-push-all ios-sim-kill ios-stage-corpus ios-unstage-corpus ios-archive ios-upload ios-build mac-generate mac-check mac-stage-corpus mac-unstage-corpus mac-dev mac-dev-run mac-build mac-verify mac-notarize mac-dmg mac-notarize-dmg mac-release mac-archive mac-upload web-install web-dev web-test web-build web-preview web-kill web-books web-books-publish

# ---------------------------------------------------------------------------
# The web forest (web/)
# ---------------------------------------------------------------------------

web-install:
	cd web && npm install

web-dev:
	cd web && npm run dev

web-test:
	cd web && npm test

web-build:
	cd web && npm run build

# The compiled bundle, as the release zip ships it: the fair place to judge the
# frame rate, since the dev server runs React in development mode. Port 5173, or
# the next free one if web-dev is still up.
web-preview: web-build
	cd web && npm run preview

# Matched by command line, not port: `npm run dev` moves to 5174 when 5173 is
# taken, and a preview server shares 5173. Only node processes running Vite's
# binary match, not a shell whose command merely mentions it. Stops Vite from
# any checkout.
web-kill:
	@pids=$$(pgrep -f '^([^ ]*/)?node [^ ]*node_modules/(\.bin/vite|vite/bin/vite\.js)( |$$)'); \
	if [ -z "$$pids" ]; then echo "no Vite servers running"; exit 0; fi; \
	ps -o pid=,command= -p "$$(echo $$pids | tr ' ' ',')"; \
	kill $$pids && echo "stopped: $$(echo $$pids)"

# The reader opens each book from web/public/books/<slug>.json, written by
# `gutenkg export-web-books` from the Swift packs (run `make export-swift` in
# gutenberg_kg first). The files are gitignored: about 175 MB, 63 MB as a
# tarball. web-books-publish uploads the tarball to the BOOK_TEXT_TAG release,
# which web.yml unpacks into the build, and redeploys Pages. The release stays
# a draft because Zenodo archives every published release, prereleases
# included; web.yml needs contents: write to read a draft.
BOOK_TEXT_TAG ?= book-text
BOOK_TEXT_TARBALL := $(patsubst %/,%,$(or $(TMPDIR),/tmp))/books.tar.gz

web-books:
	$(MAKE) -C "$(GUTENBERG_KG_DIR)" export-web-books KNOWLEDGE_PRESS_DIR="$(CURDIR)"

web-books-publish:
	@test -n "$$(ls web/public/books 2>/dev/null)" \
	  || { echo "No book text in web/public/books -- run 'make web-books' first."; exit 1; }
	tar -czf "$(BOOK_TEXT_TARBALL)" -C web/public/books .
	gh release view $(BOOK_TEXT_TAG) >/dev/null 2>&1 \
	  || gh release create $(BOOK_TEXT_TAG) --draft --title "Book text for the web forest" \
	       --notes "books.tar.gz: every book's chapters for the forest reader, from 'make web-books'. Kept a draft so Zenodo does not archive it; do not publish."
	gh release upload $(BOOK_TEXT_TAG) "$(BOOK_TEXT_TARBALL)" --clobber
	rm -f "$(BOOK_TEXT_TARBALL)"
	gh workflow run web.yml --ref main

# ---------------------------------------------------------------------------
# The app icon (app/icon)
#
# app/icon/press-seal.svg and press-seal-macos.svg are the artwork. This
# re-renders the 1024 px master (with its iOS and splash copies), the proof
# strip and the ten macOS sizes from them; commit the PNGs it writes. macOS
# only, since it draws the SVGs with AppKit.
# ---------------------------------------------------------------------------

icons:
	swift app/icon/render_icons.swift

# ---------------------------------------------------------------------------
# The Knowledge Press -- iPhone app (app/ios)
#
# Codifies app/RUNBOOK.md section 6. The generated .xcodeproj is gitignored;
# project.yml is the source of truth, so `ios-generate` is safe to re-run and
# anything hand-edited in Xcode's target editor is lost by design.
# ---------------------------------------------------------------------------

IOS_BUNDLE_ID ?= com.fluxfrontiers.knowledgepress
IOS_CORPUS_DIR ?= $(GUTENBERG_KG_DIR)/bundles/gutenberg-all/swift
IOS_CONTAINER_PATH = Library/Application Support/Corpus
IOS_DEVICE ?=

# Resolve the target device inside a recipe: honour IOS_DEVICE when set, else
# take the single connected phone, else say so and stop.
# Picks the first device that is actually reachable, not simply the first one
# listed. `devicectl list devices` reports every device it has ever paired
# with, so d[0] was as likely to be an iPad asleep on another network as the
# phone on the desk -- and devicectl then failed on it with a usage-assertion
# error (CoreDeviceError 4016) that named no device at all.
#
# tunnelState is the field that distinguishes them. Only "unavailable" is
# disqualifying: "disconnected" is the resting state of a perfectly reachable
# device, since devicectl drops the tunnel between commands and reopens it on
# demand -- a phone that worked a minute ago reads "disconnected" now, so
# requiring "connected" would reject the very device you just deployed to. It
# is still worth preferring when present, hence the sort. sameMachine
# transport excludes simulators, which these targets never mean.
define ios_resolve_device
DEV="$(IOS_DEVICE)"; \
if [ -z "$$DEV" ]; then \
	DEV=$$(xcrun devicectl list devices --json-output /dev/stdout 2>/dev/null \
	  | python3 -c 'import json,sys; d=json.load(sys.stdin)["result"]["devices"]; c=lambda x: x.get("connectionProperties",{}); d=[x for x in d if c(x).get("tunnelState")!="unavailable" and c(x).get("transportType")!="sameMachine"]; d.sort(key=lambda x: c(x).get("tunnelState")!="connected"); print(d[0]["identifier"] if d else "")'); \
fi; \
if [ -z "$$DEV" ]; then \
	echo "No reachable iOS device. Wake one and unlock it, enable Developer Mode,"; \
	echo "or pass IOS_DEVICE=<udid|name>.  'make ios-devices' lists what is paired."; \
	exit 1; \
fi
endef

ios-devices:
	@xcrun devicectl list devices

ios-generate:
	@command -v xcodegen >/dev/null 2>&1 \
	  || { echo "xcodegen not found -- brew install xcodegen"; exit 1; }
	cd app/ios && xcodegen generate

# Compiles for a real device without a phone, an Apple account, or a
# signature -- so a code failure is never confused with a signing one.
ios-check: ios-generate
	cd app/ios && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj -scheme KnowledgePress \
	  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build

# Run the app on the device at least once first, so its container exists.
# Unchanged files are skipped, so re-running after a fresh export only moves
# what actually differs.
ios-install-corpus:
	@test -f "$(IOS_CORPUS_DIR)/manifest.json" \
	  || { echo "No corpus at $(IOS_CORPUS_DIR) -- run 'gutenkg export-swift --verify' in $(GUTENBERG_KG_DIR) first."; exit 1; }
	@$(ios_resolve_device); \
	cd "$(IOS_CORPUS_DIR)" && xcrun devicectl device copy to --device "$$DEV" \
	  --domain-type appDataContainer --domain-identifier $(IOS_BUNDLE_ID) \
	  --destination "$(IOS_CONTAINER_PATH)" \
	  $$(for f in *; do printf -- '--source %s ' "$$f"; done)

# Sixteen entries, because BGEEmbedder.mlpackage lists its insides. The one
# that matters is .../weights/weight.bin at ~63 MB: a flattened copy of that
# bundle is what leaves the app reporting a corpus it cannot open.
ios-verify-corpus:
	@$(ios_resolve_device); \
	xcrun devicectl device info files --device "$$DEV" \
	  --domain-type appDataContainer --domain-identifier $(IOS_BUNDLE_ID) \
	  --subdirectory "$(IOS_CONTAINER_PATH)"

ios-launch:
	@$(ios_resolve_device); \
	xcrun devicectl device process launch --device "$$DEV" \
	  --terminate-existing $(IOS_BUNDLE_ID)

ios-deploy: ios-install-corpus ios-verify-corpus ios-launch
	@echo "Corpus installed and app relaunched. Settings > Corpus should say 'on this device'."

# ---------------------------------------------------------------------------
# Simulator, for App Store screenshots. The device targets above use devicectl,
# which does not talk to simulators; simctl does the same three jobs here:
# install the app, copy the corpus into its data container, and launch it.
# The status bar is overridden to Apple's own 9:41 / full-signal look, so the
# screenshots need no cropping and come out at the exact size App Store
# Connect wants for that device. On-device answers work in the simulator when
# this Mac has Apple Intelligence turned on.
#
#   make ios-sim SIM="iPhone 17 Pro Max"      # 6.9" iPhone slot
#   make ios-sim SIM="iPad Pro 13-inch (M5)"  # 13" iPad slot
#   make ios-sim-screenshot                   # -> screenshots/<SIM>-<time>.png
#   make ios-sim-kill                         # shut every booted simulator down
#   SIM_APPEARANCE=light for a light-mode set; dark is the default.
# ---------------------------------------------------------------------------

SIM ?= iPhone 17 Pro Max
IOS_SIM_APP = app/ios/build/sim/Build/Products/Debug-iphonesimulator/KnowledgePress.app

ios-sim-build: ios-generate
	cd app/ios && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj -scheme KnowledgePress \
	  -destination "platform=iOS Simulator,name=$(SIM)" -derivedDataPath build/sim \
	  CODE_SIGNING_ALLOWED=NO build

# Xcode 27 replaced Simulator.app with DeviceHub.app; older Xcodes keep
# Simulator.app under Developer/Applications. Open whichever exists.
ios-sim-boot:
	@xcrun simctl boot "$(SIM)" 2>/dev/null || true
	@apps="$$(xcode-select -p)/../Applications"; \
	  if [ -d "$$apps/DeviceHub.app" ]; then open "$$apps/DeviceHub.app"; \
	  else open "$$(xcode-select -p)/Applications/Simulator.app"; fi
	@xcrun simctl bootstatus "$(SIM)" -b >/dev/null

# Copies the whole export, embedder included, into the app's container. The
# app must be installed first so the container exists.
ios-sim-install-corpus: ios-sim-boot
	@test -f "$(IOS_CORPUS_DIR)/manifest.json" \
	  || { echo "No corpus at $(IOS_CORPUS_DIR) -- run 'gutenkg export-swift --verify' in $(GUTENBERG_KG_DIR) first."; exit 1; }
	@xcrun simctl install "$(SIM)" "$(IOS_SIM_APP)"
	@dest="$$(xcrun simctl get_app_container "$(SIM)" $(IOS_BUNDLE_ID) data)/$(IOS_CONTAINER_PATH)"; \
	  mkdir -p "$$dest" && cp -R "$(IOS_CORPUS_DIR)/." "$$dest/" && du -sh "$$dest"

SIM_APPEARANCE ?= dark

ios-sim-launch: ios-sim-boot
	@xcrun simctl ui "$(SIM)" appearance $(SIM_APPEARANCE)
	@xcrun simctl status_bar "$(SIM)" override --time 9:41 --batteryState charged --batteryLevel 100 \
	  --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3
	@xcrun simctl launch --terminate-running-process "$(SIM)" $(IOS_BUNDLE_ID) >/dev/null

ios-sim: ios-sim-build ios-sim-install-corpus ios-sim-launch
	@echo "$(SIM) is up with the corpus. Settings > Corpus should say 'on this device'."

ios-sim-screenshot:
	@mkdir -p screenshots
	@out="screenshots/$$(echo '$(SIM)' | tr ' ' '-')-$$(date +%H%M%S).png"; \
	  xcrun simctl io "$(SIM)" screenshot "$$out" >/dev/null 2>&1 && echo "$$out"

# ios-sim boots a simulator and nothing shuts it down again: it outlives
# Xcode, the Simulator or DeviceHub window and the shell that ran make, and
# each one is a full iOS userland. The two screenshot devices left booted
# overnight held 43 GB between them and pinned swap. Closing the window does
# not stop the device; this does. Shuts down every booted simulator, not only
# $(SIM). Their installed apps and corpora survive a shutdown.
ios-sim-kill:
	@booted=$$(xcrun simctl list devices booted | sed -n 's/^ *\(.*\) (\([0-9A-F-]*\)) (Booted).*/\1/p'); \
	if [ -z "$$booted" ]; then echo "no simulators booted"; exit 0; fi; \
	echo "$$booted"; \
	xcrun simctl shutdown all && echo "shut down."

# App build number (CFBundleVersion) for every xcodebuild below: the git commit
# count, which only grows, so each App Store Connect upload outranks the last
# without anyone bumping it. The version string itself is MARKETING_VERSION in
# project.yml.
#
# The app moved here from gutenberg_kg, whose count stood at 605 when this
# repo's history (107 commits, the same tip) was split out of it. Builds
# already uploaded from there carry numbers up to 605, so this repo's count is
# offset by the difference: the tip it inherited builds as 605 again, and every
# new commit here numbers above anything App Store Connect has seen.
APP_BUILD_OFFSET := 498
APP_BUILD ?= $(shell echo $$(( $$(git rev-list --count HEAD 2>/dev/null || echo 1) + $(APP_BUILD_OFFSET) )))

IOS_APP = app/ios/build/Build/Products/Debug-iphoneos/KnowledgePress.app
IOS_TEAM ?=

# Resolve the Apple Developer Team ID from this machine, so no one's team is
# hardcoded here -- the same reason mac_resolve_identity reads the signer out
# of the keychain rather than naming them.
#
# project.yml carries no team and xcodegen wipes whatever was set in Xcode's
# Signing & Capabilities editor, so it has to arrive as a build setting; the
# question is only where it comes from.
#
# NOT from the Apple Development certificate: its parenthesised value is the
# certificate's own id, not the team's (23JL... vs 552T...), and a build
# signed against that fails in a way that names neither. A provisioning
# profile's TeamIdentifier is the real one, and automatic signing writes a
# profile the first time the app is Run on a device from Xcode. The Developer
# ID certificate carries it too and is the fallback.
define ios_resolve_team
TEAM="$(IOS_TEAM)"; \
if [ -z "$$TEAM" ]; then \
	TEAM=$$(for p in "$$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"/*.mobileprovision \
	                 "$$HOME/Library/MobileDevice/Provisioning Profiles"/*.mobileprovision; do \
		[ -f "$$p" ] || continue; \
		security cms -D -i "$$p" 2>/dev/null | plutil -extract TeamIdentifier.0 raw - 2>/dev/null; \
	done | head -1); \
fi; \
if [ -z "$$TEAM" ]; then \
	TEAM=$$(security find-identity -v -p codesigning \
	  | sed -n 's/.*"Developer ID Application: .*(\([A-Z0-9]*\))".*/\1/p' | head -1); \
fi; \
if [ -z "$$TEAM" ]; then \
	echo "No Apple Developer Team ID found on this machine."; \
	echo "Sign in at Xcode > Settings > Accounts and Run the app on a device once,"; \
	echo "or pass IOS_TEAM=<teamid>."; \
	exit 1; \
fi
endef

# Signed build for a real device -- unlike ios-check, signing is left on, so
# this only works once each target device has been Run from Xcode at least
# once (RUNBOOK.md section 6: automatic signing has to see and trust a device
# before a CLI build can install to it).
ios-build: ios-generate
	@$(ios_resolve_team); \
	cd app/ios && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj -scheme KnowledgePress \
	  -destination 'generic/platform=iOS' -derivedDataPath build \
	  -allowProvisioningUpdates \
	  DEVELOPMENT_TEAM="$$TEAM" build

# Copy the exported corpus into app/ios/Corpus so an archive ships it inside
# the app. Development builds do not need this -- `make ios-install-corpus`
# pushes the corpus to the device's Application Support instead, and
# CorpusPacks prefers that copy over the bundled one.
#
# 743 MB in, 743 MB out, read in place: the packs open SQLITE_OPEN_READONLY
# and nothing writes to them, so nothing is ever copied back out of the
# bundle at runtime. Users download about 296 MB, since the .ipa is
# compressed and the packs are SQLite.
ios-stage-corpus:
	@test -f "$(IOS_CORPUS_DIR)/manifest.json" \
	  || { echo "No exported corpus at $(IOS_CORPUS_DIR) -- run 'make export-swift' in $(GUTENBERG_KG_DIR) first."; exit 1; }
	@echo "Staging corpus into app/ios/Corpus ..."
	@rm -rf app/ios/Corpus && mkdir -p app/ios/Corpus
	@cp -R "$(IOS_CORPUS_DIR)/." app/ios/Corpus/
	@du -sh app/ios/Corpus

# Remove the staged corpus, so an ordinary device build stops carrying it.
ios-unstage-corpus:
	@rm -rf app/ios/Corpus && mkdir -p app/ios/Corpus
	@git checkout -- app/ios/Corpus/.gitkeep 2>/dev/null || true
	@echo "app/ios/Corpus emptied."

# Release archive for App Store Connect. Requires the corpus to be staged --
# checked rather than assumed, because an archive that builds, uploads and
# passes review with an empty Corpus folder is an app that does nothing, and
# the only symptom is a reviewer's rejection a week later.
ios-archive: ios-stage-corpus ios-generate
	@$(ios_resolve_team); \
	cd app/ios && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj -scheme KnowledgePress \
	  -destination 'generic/platform=iOS' -archivePath build/KnowledgePress.xcarchive \
	  -allowProvisioningUpdates \
	  DEVELOPMENT_TEAM="$$TEAM" archive

# Export the archive as a signed .ipa and upload it to App Store Connect.
#
# Needs an App Store Connect API key in the keychain or ~/.appstoreconnect;
# `xcodebuild -exportArchive` prompts otherwise. See app/RUNBOOK.md section 8.
ios-upload: ios-archive
	@$(ios_resolve_team); \
	cd app/ios && xcodebuild -exportArchive \
	  -archivePath build/KnowledgePress.xcarchive \
	  -exportOptionsPlist ExportOptions.plist \
	  -exportPath build/export \
	  -allowProvisioningUpdates \
	  && xcrun altool --upload-app --type ios \
	     --file build/export/KnowledgePress.ipa \
	     --apiKey "$$ASC_KEY_ID" --apiIssuer "$$ASC_ISSUER_ID"

# Installs and (re)launches the build on every reachable physical device.
#
# Reads the JSON rather than the printed table, on the same rule as
# ios_resolve_device: tunnelState "unavailable" is out, "connected" and
# "disconnected" are both in, and sameMachine transport drops simulators. The
# table's own State column was the first attempt and does not survive contact
# -- it prints "available (paired)" for an idle device but "connected" for one
# with a live tunnel, so grepping for "available" silently skipped every device
# that was ready to receive.
define ios_reachable_devices
xcrun devicectl list devices --json-output /dev/stdout 2>/dev/null \
  | python3 -c 'import json,sys; d=json.load(sys.stdin)["result"]["devices"]; c=lambda x: x.get("connectionProperties",{}); print("\n".join(x["identifier"] for x in d if c(x).get("tunnelState")!="unavailable" and c(x).get("transportType")!="sameMachine"))'
endef

ios-deploy-all: ios-build
	@ids=$$($(ios_reachable_devices)); \
	if [ -z "$$ids" ]; then \
		echo "No reachable physical devices. Wake and unlock one; see 'make ios-devices'."; \
		exit 1; \
	fi; \
	for id in $$ids; do \
		echo "--- $$id ---"; \
		xcrun devicectl device install app --device "$$id" "$(IOS_APP)" && \
		xcrun devicectl device process launch --device "$$id" --terminate-existing $(IOS_BUNDLE_ID); \
	done

# ios-deploy-all plus the corpus: build once, then on every reachable device
# install the app, copy the packs and relaunch. About 690 MB per device over
# Wi-Fi, and a device can drop off mid-copy, so a failure on one is recorded
# and the loop moves on to the next; the target still exits non-zero at the
# end and names what to retry. Does not re-export -- run `make export-swift`
# first after a corpus change.
ios-push-all: ios-build
	@test -f "$(IOS_CORPUS_DIR)/manifest.json" \
	  || { echo "No corpus at $(IOS_CORPUS_DIR) -- run 'make export-swift' in $(GUTENBERG_KG_DIR) first."; exit 1; }
	@ids=$$($(ios_reachable_devices)); \
	if [ -z "$$ids" ]; then \
		echo "No reachable physical devices. Wake and unlock one; see 'make ios-devices'."; \
		exit 1; \
	fi; \
	failed=""; \
	for id in $$ids; do \
		echo "--- $$id ---"; \
		xcrun devicectl device install app --device "$$id" "$(IOS_APP)" \
		  && $(MAKE) --no-print-directory ios-install-corpus IOS_DEVICE="$$id" \
		  && xcrun devicectl device process launch --device "$$id" --terminate-existing $(IOS_BUNDLE_ID) \
		  || failed="$$failed $$id"; \
	done; \
	if [ -n "$$failed" ]; then \
		echo "Failed on:$$failed"; \
		echo "Wake and unlock them, then rerun this, or 'make ios-deploy IOS_DEVICE=<id>' for the corpus alone."; \
		exit 1; \
	fi; \
	echo "App and corpus pushed to every reachable device."

# ---------------------------------------------------------------------------
# The Knowledge Press -- Mac app (app/macos)
#
# `swift run KnowledgePress` from app/GutenbergKGKit is still the fast loop.
# These targets produce the thing a SwiftPM executable cannot be: a signed,
# notarized bundle someone else can install.
#
# The release build carries the corpus inside the .app, as the App Store iOS
# build does; CorpusPacks.bundledDirectory() finds it in Contents/Resources.
# An installed corpus still wins over the bundled one.
#
# The Developer ID build is unsandboxed -- mac-build drops the entitlements
# file -- so it reads the same ~/Library/Application Support/Corpus that
# `swift run` does. mac-dev and mac-archive carry App Sandbox, so theirs is
# inside ~/Library/Containers/com.fluxfrontiers.knowledgepress; both bundle
# the corpus rather than rely on one being copied there.
# ---------------------------------------------------------------------------

MAC_BUILD_DIR ?= app/macos/build
MAC_CORPUS_DIR ?= $(IOS_CORPUS_DIR)
MAC_APP = $(MAC_BUILD_DIR)/Build/Products/Release/KnowledgePress.app
MAC_DMG ?= $(MAC_BUILD_DIR)/KnowledgePress.dmg
# `notarytool store-credentials <name>` writes this; see RUNBOOK section 7.
MAC_NOTARY_PROFILE ?= knowledgepress-notary

# Resolve the Developer ID Application identity from the login keychain, so
# the signer's name is never hardcoded here.
define mac_resolve_identity
IDENTITY=$$(security find-identity -v -p codesigning \
	  | sed -n 's/.*"\(Developer ID Application: .*\)"/\1/p' | head -1); \
if [ -z "$$IDENTITY" ]; then \
	echo "No Developer ID Application certificate in the login keychain."; \
	echo "Xcode > Settings > Accounts > Manage Certificates > + Developer ID Application."; \
	exit 1; \
fi; \
TEAM=$$(printf '%s' "$$IDENTITY" | sed -n 's/.*(\([A-Z0-9]*\))$$/\1/p')
endef

mac-generate:
	@command -v xcodegen >/dev/null 2>&1 \
	  || { echo "xcodegen not found -- brew install xcodegen"; exit 1; }
	cd app/macos && xcodegen generate

# Compiles without a certificate, so a code failure is never confused with a
# signing one -- the same role ios-check plays, and what CI runs.
mac-check: mac-generate
	cd app/macos && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj \
	  -scheme KnowledgePress -destination 'platform=macOS' \
	  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build | tail -3

# Copy the exported corpus into app/macos/Corpus so the release build ships it
# inside the app; the Mac twin of ios-stage-corpus. mac-dev and `swift run` do
# not need it -- they read ~/Library/Application Support/Corpus, which
# CorpusPacks prefers over the bundled copy anyway.
mac-stage-corpus:
	@test -f "$(MAC_CORPUS_DIR)/manifest.json" \
	  || { echo "No exported corpus at $(MAC_CORPUS_DIR) -- run 'make export-swift' in $(GUTENBERG_KG_DIR) first."; exit 1; }
	@echo "Staging corpus into app/macos/Corpus ..."
	@rm -rf app/macos/Corpus && mkdir -p app/macos/Corpus
	@cp -R "$(MAC_CORPUS_DIR)/." app/macos/Corpus/
	@git checkout -- app/macos/Corpus/.gitkeep 2>/dev/null || true
	@du -sh app/macos/Corpus

# Remove the staged corpus, so mac-check and mac-dev stop carrying it.
mac-unstage-corpus:
	@rm -rf app/macos/Corpus && mkdir -p app/macos/Corpus
	@git checkout -- app/macos/Corpus/.gitkeep 2>/dev/null || true
	@echo "app/macos/Corpus emptied."

# Stages the corpus first, for the same reason ios-archive does: a notarized
# .app with an empty Corpus folder installs, launches, and answers nothing.
#
# Developer ID signing takes no Private Cloud Compute: Apple's Developer ID
# profile for this App ID does not grant it (the development and App Store
# profiles do), and xcodebuild refuses to sign a restricted entitlement
# without a profile granting it. So this build alone drops the entitlements
# file on the command line; project.yml keeps PCC for every other build.
# The notarized app answers on-device only.
mac-build: mac-stage-corpus mac-generate
	@$(mac_resolve_identity); \
	echo "Signing as $$IDENTITY"; \
	cd app/macos && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj \
	  -scheme KnowledgePress -destination 'platform=macOS' \
	  -derivedDataPath build -configuration Release \
	  CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$$TEAM" \
	  CODE_SIGN_IDENTITY="$$IDENTITY" OTHER_CODE_SIGN_FLAGS="--timestamp" \
	  CODE_SIGN_ENTITLEMENTS= \
	  build | tail -3

# A Debug build signed with the Apple Development identity through automatic
# signing, which is the only way a Mac build gets a provisioning profile
# carrying the Private Cloud Compute entitlement today. Runs from the build
# directory; it is not notarized and is not for anyone else's machine. Same
# `-allowProvisioningUpdates` lesson as ios-build: without it xcodebuild
# cannot mint the profile and fails with "No profiles for ... were found".
# A Mac App Development profile also names the Mac it runs on, so the first
# build on a machine fails with `Device "<host>" isn't registered in your
# developer account` unless `-allowProvisioningDeviceRegistration` lets
# xcodebuild add it. Both flags together are what Xcode's own Run button does.
#
# Sandboxed, like the App Store build, so it stages the corpus too: its
# Application Support is the app's container, not the one `swift run` fills.
mac-dev: mac-stage-corpus mac-generate
	@$(ios_resolve_team); \
	cd app/macos && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj \
	  -scheme KnowledgePress -destination 'platform=macOS' \
	  -derivedDataPath build -configuration Debug \
	  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
	  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$$TEAM" \
	  build

# Launch the mac-dev build; see mac-dev.
mac-dev-run: mac-dev
	open app/macos/build/Build/Products/Debug/KnowledgePress.app

# The checks worth making before spending a notarization round trip. The
# entitlements check is the one that matters: Xcode injects
# com.apple.security.get-task-allow unless CODE_SIGN_INJECT_BASE_ENTITLEMENTS
# is NO, the notary service rejects anything carrying it, and the app signs
# and passes spctl locally either way.
mac-verify:
	@test -d "$(MAC_APP)" || { echo "No app at $(MAC_APP) -- run 'make mac-build'."; exit 1; }
	@echo "== architectures =="
	@lipo -archs "$(MAC_APP)/Contents/MacOS/KnowledgePress"
	@echo "== signature =="
	@codesign -dvvv "$(MAC_APP)" 2>&1 | grep -E 'Authority|TeamIdentifier|flags|Timestamp'
	@echo "== hardened runtime =="
	@codesign -dvvv "$(MAC_APP)" 2>&1 | grep -q '0x10000(runtime)' \
	  && echo "enabled" \
	  || { echo "MISSING -- notarization will fail"; exit 1; }
	@echo "== debug entitlement =="
	@codesign -d --entitlements - "$(MAC_APP)" 2>&1 | grep -q 'get-task-allow' \
	  && { echo "PRESENT -- notarization will be rejected"; exit 1; } \
	  || echo "absent"
	@echo "== bundled corpus =="
	@test -f "$(MAC_APP)/Contents/Resources/Corpus/manifest.json" \
	  && du -sh "$(MAC_APP)/Contents/Resources/Corpus" | cut -f1 \
	  || { echo "MISSING -- the app would ship with no corpus; run 'make mac-build'"; exit 1; }
	@echo "== gatekeeper =="
	@spctl -a -vvv -t exec "$(MAC_APP)" 2>&1 | head -3

define mac_require_notary_profile
xcrun notarytool history --keychain-profile "$(MAC_NOTARY_PROFILE)" >/dev/null 2>&1 \
  || { echo "No notarytool profile '$(MAC_NOTARY_PROFILE)'. Create it once:"; \
	echo "  xcrun notarytool store-credentials $(MAC_NOTARY_PROFILE) \\"; \
	echo "    --apple-id <your-apple-id> --team-id <team> --password <app-specific-password>"; \
	echo "App-specific passwords come from appleid.apple.com, not your Apple ID password."; \
	exit 1; }
endef

mac-notarize: mac-verify
	@$(mac_require_notary_profile)
	ditto -c -k --keepParent "$(MAC_APP)" "$(MAC_BUILD_DIR)/KnowledgePress.zip"
	xcrun notarytool submit "$(MAC_BUILD_DIR)/KnowledgePress.zip" \
	  --keychain-profile "$(MAC_NOTARY_PROFILE)" --wait
	xcrun stapler staple "$(MAC_APP)"
	@echo "Stapled. The app now launches on a machine that has never seen it."

# The disk image needs signing in its own right. Stapling the .app inside is
# not enough: a .dmg downloaded from the internet carries a quarantine flag,
# and Gatekeeper assesses the *image* when it is mounted. An unsigned one is
# refused ("source=no usable signature") before the reader ever reaches the
# app, so `make mac-release` would report success and hand you something that
# fails on the recipient's machine.
#
# hdiutil is deprecated on macOS 26+ in favour of `diskutil image create`,
# which does not exist on older systems. Keeping hdiutil until the floor
# rises; the warning is expected.
mac-dmg:
	@test -d "$(MAC_APP)" || { echo "No app at $(MAC_APP) -- run 'make mac-build'."; exit 1; }
	@rm -f "$(MAC_DMG)"
	hdiutil create -volname "Knowledge Press" -srcfolder "$(MAC_APP)" \
	  -ov -format UDZO "$(MAC_DMG)"
	@$(mac_resolve_identity); \
	codesign --force --sign "$$IDENTITY" --timestamp "$(MAC_DMG)"
	@echo "Wrote and signed $(MAC_DMG)"

# A second round trip, and worth it. Notarizing the image covers the
# container the recipient actually double-clicks; the app was stapled
# separately so it still launches offline once copied out of the image, which
# a dmg-only ticket would not guarantee.
mac-notarize-dmg:
	@test -f "$(MAC_DMG)" || { echo "No dmg at $(MAC_DMG) -- run 'make mac-dmg'."; exit 1; }
	@$(mac_require_notary_profile)
	xcrun notarytool submit "$(MAC_DMG)" \
	  --keychain-profile "$(MAC_NOTARY_PROFILE)" --wait
	xcrun stapler staple "$(MAC_DMG)"
	@echo "== dmg gatekeeper verdict =="
	@spctl -a -vvv -t open --context context:primary-signature "$(MAC_DMG)" 2>&1 | head -3

mac-release: mac-build mac-verify mac-notarize mac-dmg mac-notarize-dmg
	@echo "Signed, notarized, stapled, packaged: $(MAC_DMG)"

# Mac App Store archive: the Mac twin of ios-archive. Automatic signing picks
# the Apple Distribution identity and a Mac App Store profile, which grants
# PCC, so unlike mac-build this keeps the entitlements file: PCC plus the App
# Sandbox the store requires. Stages the corpus for ios-archive's reason.
mac-archive: mac-stage-corpus mac-generate
	@$(ios_resolve_team); \
	cd app/macos && xcodebuild CURRENT_PROJECT_VERSION=$(APP_BUILD) -project KnowledgePress.xcodeproj \
	  -scheme KnowledgePress -destination 'generic/platform=macOS' \
	  -archivePath build/KnowledgePress.xcarchive \
	  -allowProvisioningUpdates \
	  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$$TEAM" archive

# Export the archive as a signed installer .pkg and upload it; the Mac twin of
# ios-upload, with the same ExportOptions.plist and the same App Store Connect
# API key. Same bundle ID as the iOS app, so it lands on that app record once
# the record has macOS added as a platform. See app/RUNBOOK.md section 8.
mac-upload: mac-archive
	@$(ios_resolve_team); \
	cd app/macos && xcodebuild -exportArchive \
	  -archivePath build/KnowledgePress.xcarchive \
	  -exportOptionsPlist ../ios/ExportOptions.plist \
	  -exportPath build/export \
	  -allowProvisioningUpdates \
	  && xcrun altool --upload-app --type macos \
	     --file build/export/KnowledgePress.pkg \
	     --apiKey "$$ASC_KEY_ID" --apiIssuer "$$ASC_ISSUER_ID"
