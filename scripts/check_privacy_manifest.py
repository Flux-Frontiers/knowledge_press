#!/usr/bin/env python3
"""Check that the app privacy manifests are well-formed and use documented keys.

App Store Connect rejected build 1.28.0 (720) with ITMS-91056, "Invalid
privacy manifest". The manifest held a comment with a double hyphen, which XML
forbids. plutil accepts that, so nothing local caught it. This parses the
manifests with expat, which rejects it, and checks the top-level keys and the
required-reason API categories against Apple's documentation:
https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
"""

from __future__ import annotations

import plistlib
import sys
from pathlib import Path
from xml.parsers.expat import ExpatError

ROOT = Path(__file__).resolve().parent.parent
MANIFESTS = (
    ROOT / "app" / "ios" / "PrivacyInfo.xcprivacy",
    ROOT / "app" / "macos" / "PrivacyInfo.xcprivacy",
)
TOP_LEVEL = {
    "NSPrivacyTracking": bool,
    "NSPrivacyTrackingDomains": list,
    "NSPrivacyCollectedDataTypes": list,
    "NSPrivacyAccessedAPITypes": list,
}
API_CATEGORIES = frozenset(
    {
        "NSPrivacyAccessedAPICategoryFileTimestamp",
        "NSPrivacyAccessedAPICategorySystemBootTime",
        "NSPrivacyAccessedAPICategoryDiskSpace",
        "NSPrivacyAccessedAPICategoryActiveKeyboards",
        "NSPrivacyAccessedAPICategoryUserDefaults",
    }
)
API_ENTRY_KEYS = frozenset(
    {"NSPrivacyAccessedAPIType", "NSPrivacyAccessedAPITypeReasons"}
)


def problems(path: Path) -> list[str]:
    """Return what is wrong with one privacy manifest.

    :param path: The manifest file.
    :return: One message per problem; empty when the manifest is valid.
    """
    try:
        manifest = plistlib.loads(path.read_bytes())
    except (ExpatError, plistlib.InvalidFileException, ValueError) as exc:
        return [f"not a well-formed property list: {exc}"]
    found: list[str] = []
    for key, kind in TOP_LEVEL.items():
        if not isinstance(manifest.get(key), kind):
            found.append(f"{key} is missing or is not a {kind.__name__}")
    found += [
        f"unknown top-level key {key}" for key in manifest if key not in TOP_LEVEL
    ]
    for entry in manifest.get("NSPrivacyAccessedAPITypes", []):
        if not isinstance(entry, dict) or set(entry) != API_ENTRY_KEYS:
            found.append(f"API entry needs exactly {sorted(API_ENTRY_KEYS)}: {entry!r}")
            continue
        if entry["NSPrivacyAccessedAPIType"] not in API_CATEGORIES:
            found.append(f"unknown API category {entry['NSPrivacyAccessedAPIType']!r}")
        reasons = entry["NSPrivacyAccessedAPITypeReasons"]
        if not (
            isinstance(reasons, list)
            and reasons
            and all(isinstance(r, str) for r in reasons)
        ):
            found.append(
                f"reasons for {entry['NSPrivacyAccessedAPIType']} must be a list of codes"
            )
    return found


def main() -> int:
    """Check every manifest and report the problems found.

    :return: 1 if any manifest has a problem, else 0.
    """
    failed = False
    for path in MANIFESTS:
        for message in problems(path):
            print(f"{path.relative_to(ROOT)}: {message}", file=sys.stderr)
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
