---
name: release
description: >
  Cut a Knowledge Press release: bump the version in every app, web and doc
  file, promote the changelog, regenerate release notes, verify with
  scripts/check_version.py, tag, and push. Use when releasing knowledge_press,
  cutting a version, or tagging v*.
---

# Release Workflow (knowledge_press)

This repo has no `pyproject.toml` and no package index, so most of the generic
`/release` command does not apply. Follow this file; where the two disagree,
this file wins. The generic's Step 9 (the Zenodo audit) is the one part to run
from there.

Releases are **tag-triggered**. Pushing a `v*` tag runs
`.github/workflows/release.yml`, which:

1. fails unless every version site matches the tag (`scripts/check_version.py`),
2. runs the web tests and builds the forest,
3. creates a GitHub Release titled `The Knowledge Press vX.Y.Z` from
   `release-notes.md`, with `knowledge-press-forest-vX.Y.Z.zip` attached.

Publishing that Release is also what makes Zenodo archive it. The apps are not
built or signed by the release; shipping them to the App Store is a separate,
manual path (`app/RUNBOOK.md` sections 7 and 8).

**A bad tag is recoverable, a bad archive is not.** Deleting the GitHub Release
and the tag undoes the release here, but once Zenodo is enabled it has already
minted a DOI for it, and a Zenodo record cannot be deleted. Get the release
commit right before the tag goes out.

---

## Step 0: Preconditions

```bash
git checkout main && git pull origin main
git status --porcelain                  # must be empty
pre-commit run --all-files              # must pass
```

Confirm `## [Unreleased]` in `CHANGELOG.md` has content. If it is empty there is
nothing to release: stop. Check that the merged work since the last release has
entries:

```bash
git log --oneline --no-merges "$(git describe --tags --abbrev=0)"..HEAD
```

The first release (v1.23.0) has no earlier tag here: the history came over from
gutenberg_kg without its tags, and entries before 1.23.0 live in gutenberg_kg's
changelog.

## Step 1: Decide the version

```bash
git tag --sort=-v:refname | head -5
git describe --tags --abbrev=0          # believe this one if they disagree
node -p "require('./web/package.json').version"
```

Semver against what a user sees in the app or the forest: a new feature is a
minor bump, a fix is a patch. If the version files already carry an untagged
bump, adopt it and skip Step 3.

## Step 2: Promote the changelog

Replace `## [Unreleased]` with `## [X.Y.Z] - YYYY-MM-DD` and put a fresh empty
`## [Unreleased]` above it. **One ASCII hyphen** between version and date:
`fleet_audit.py` and `check_version.py` both parse that heading. Merge duplicate
`### Added` / `### Changed` / `### Fixed` headings while you are there.

## Step 3: Bump the version

Nothing derives the version from a single source. Change all of these:

```bash
V=X.Y.Z
(cd web && npm version "$V" --no-git-tag-version)   # package.json + package-lock.json
sed -i '' -E "s/MARKETING_VERSION: \"[^\"]+\"/MARKETING_VERSION: \"$V\"/" \
  app/ios/project.yml app/macos/project.yml
sed -i '' -E "s/static let fallback = \"[^\"]+\"/static let fallback = \"$V\"/" \
  app/GutenbergKGKit/Sources/KnowledgePressUI/AppVersion.swift
```

Then by hand:

- `CITATION.cff`: `version:` and `date-released:` (today).
- `README.md`: the version badge, the APA line `(Version X.Y.Z) [Software]`,
  and the BibTeX `version   = {X.Y.Z},`.

The app build number is not bumped by hand. The Makefile sets it to the commit
count plus `APP_BUILD_OFFSET`.

## Step 4: Regenerate release-notes.md

Generate it from the promoted changelog section; never hand-edit it. It is the
body of the GitHub Release, written at tag time.

```bash
python3 - <<'EOF'
import pathlib, re
VERSION, DATE = "X.Y.Z", "YYYY-MM-DD"
cl = pathlib.Path("CHANGELOG.md").read_text()
body = re.search(rf"^## \[{re.escape(VERSION)}\] - {DATE}\n(.*?)(?=^## \[|\Z)",
                 cl, re.S | re.M).group(1).strip("\n")
pathlib.Path("release-notes.md").write_text(
    f"# Release Notes -- v{VERSION}\n\n> Released: {DATE}\n\n{body}\n\n"
    "---\n\n_Full changelog: [CHANGELOG.md](CHANGELOG.md)_\n")
EOF
head -1 release-notes.md                # must name vX.Y.Z
```

## Step 5: Verify

```bash
python3 scripts/check_version.py X.Y.Z  # all 12 sites; the release job runs the same check
pre-commit run --all-files
make ios-check mac-check                # optional: app.yml runs these after the push
```

If a new version site ever appears (another app target, a docs page stamping
the version), add it to `SITES` in `scripts/check_version.py` in the same
commit.

## Step 6: Commit

```bash
git add CHANGELOG.md release-notes.md CITATION.cff README.md \
        web/package.json web/package-lock.json \
        app/ios/project.yml app/macos/project.yml \
        app/GutenbergKGKit/Sources/KnowledgePressUI/AppVersion.swift
git commit -m "chore(release): vX.Y.Z release notes"
```

End the message with the co-author trailer. If a hook rewrites a file, stage it
and commit again.

## Step 7: Push main (ASK FIRST)

```bash
git push origin main
gh run list --branch main --limit 5     # CI, App and Web must go green
```

The bump touches `app/` and `web/`, so App and Web both run on this push. Wait
for them before tagging: a tag on a commit whose app no longer builds is still a
release, and Zenodo will archive it.

## Step 8: Tag and push the tag (ASK FIRST, always)

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
```

Show the user the check_version result and the tag, and say what the push
triggers (the three steps at the top of this file). Only on an explicit yes:

```bash
git push origin vX.Y.Z
gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
gh release view vX.Y.Z                  # notes are this version's; the zip is attached
```

If the release job fails, fix it on `main`, then delete and re-create the tag
(`git tag -d vX.Y.Z && git push origin --delete vX.Y.Z`, confirm first). No
GitHub Release exists until the job succeeds, so Zenodo has archived nothing
yet.

## Step 9: Zenodo

Run the generic `/release` Step 9 audit. Two things specific to this repo:

- **Licence.** The root licence is Elastic-2.0, which has no Zenodo vocabulary
  id, so Zenodo re-guesses the licence on every release. Fix each new record
  with `kgrag_priv/scripts/fix-zenodo-license.sh <record_id>`.
- **First archive only.** Once the first record exists, take the **concept**
  DOI from the API (not the record page) and add it in four places: a
  shields.io DOI badge in the README, the APA line's link, `doi = {...}` in the
  README BibTeX, and `doi:` in `CITATION.cff`. After that the concept DOI never
  changes and later releases need no DOI edits.
