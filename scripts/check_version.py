#!/usr/bin/env python3
"""Check that every file declaring the release version agrees with it.

The apps and the web forest carry the version in several files with no single
source to derive it from. release.yml runs this against the pushed tag so a
release cannot ship with one of them stale; run it locally before tagging:

    python3 scripts/check_version.py 1.23.0

With no argument it checks the other sites against web/package.json, which is
how pre-commit and ci.yml keep them in step between releases.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (file, regex whose first group is the declared version)
SITES = [
    ("web/package.json", r'^  "version": "([^"]+)"'),
    ("web/package-lock.json", r'^  "version": "([^"]+)"'),
    ("web/package-lock.json", r'^      "version": "([^"]+)"'),
    ("app/ios/project.yml", r'MARKETING_VERSION: "([^"]+)"'),
    ("app/macos/project.yml", r'MARKETING_VERSION: "([^"]+)"'),
    (
        "app/GutenbergKGKit/Sources/KnowledgePressUI/AppVersion.swift",
        r'static let fallback = "([^"]+)"',
    ),
    ("CITATION.cff", r'^version: "([^"]+)"'),
    ("README.md", r"badge/version-([0-9][^-]*)-"),
    ("README.md", r"\(Version ([^)]+)\) \[Software\]"),
    ("README.md", r"version\s+= \{([^}]+)\}"),
    ("CHANGELOG.md", r"^## \[([0-9][^\]]*)\] - "),
    ("release-notes.md", r"^# Release Notes -- v(\S+)"),
]


def check(version: str) -> list[str]:
    """Return one message per site that does not declare ``version``.

    :param version: The expected version, without a leading ``v``.
    :return: Mismatch messages; empty when every site agrees.
    """
    problems = []
    for rel, pattern in SITES:
        path = ROOT / rel
        if not path.exists():
            problems.append(f"{rel}: missing")
            continue
        match = re.search(pattern, path.read_text(), re.M)
        if match is None:
            problems.append(f"{rel}: no version found for /{pattern}/")
        elif match.group(1) != version:
            problems.append(f"{rel}: {match.group(1)} (want {version})")
    return problems


def main() -> int:
    if len(sys.argv) > 2:
        print("usage: check_version.py [X.Y.Z]", file=sys.stderr)
        return 2
    if len(sys.argv) == 2:
        version = sys.argv[1].removeprefix("v")
    else:
        version = json.loads((ROOT / "web/package.json").read_text())["version"]
    problems = check(version)
    for p in problems:
        print(f"version mismatch: {p}", file=sys.stderr)
    if not problems:
        print(f"all {len(SITES)} version sites declare {version}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
