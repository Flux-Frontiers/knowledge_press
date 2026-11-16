"""Download assets from Blender's online Essentials library into a local cache.

The library is the one Blender 5.2's Asset Browser lists as "Essentials"
(online part). Each file is checked against the SHA256 the library's listing
gives, and skipped if the cached copy already matches.

    python3 scripts/forest3d/fetch_essentials.py [--cache DIR] [--list]

The default cache is ~/Library/Caches/knowledge_press/blender-essentials.
build_blend.py reads it with --assets DIR.
"""

import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

BASE = "https://cdn.extensions.blender.org/asset-libraries/essentials/"
UA = {"User-Agent": "knowledge-press-forest3d"}
# Files the forest uses: procedural bricks and metals, and the outdoor HDRI worlds.
WANTED = [
    "materials/materials__bricks.blend",
    "materials/materials__metal.blend",
    "materials/materials__wood.blend",
    "world_hdri/world_hdris__forest.blend",
    "world_hdri/world_hdris__sunrise.blend",
    "world_hdri/world_hdris__sunset.blend",
    "world_hdri/world_hdris__night.blend",
]


def get_json(rel):
    with urllib.request.urlopen(
        urllib.request.Request(BASE + rel, headers=UA), timeout=60
    ) as r:
        return json.load(r)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return "SHA256:" + h.hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "--cache",
        type=Path,
        default=Path.home() / "Library/Caches/knowledge_press/blender-essentials",
    )
    ap.add_argument(
        "--list",
        action="store_true",
        help="list the library's materials and worlds and exit",
    )
    args = ap.parse_args()

    index = get_json(get_json("_asset-library-meta.json")["api_versions"]["v1"]["url"])
    assets, files = [], {}
    for page in index["pages"]:
        p = get_json(page["url"])
        assets += p["assets"]
        files.update({f["path"]: f for f in p["files"]})
    if args.list:
        for a in assets:
            if a["id_type"] in ("MATERIAL", "WORLD"):
                print(f"{a['id_type']:9} {a['name']:32} {a['files'][0]}")
        return 0

    args.cache.mkdir(parents=True, exist_ok=True)
    for rel in WANTED:
        f = files[rel]
        dest = args.cache / rel
        if dest.exists() and sha256(dest) == f["hash"]:
            print("cached ", rel)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"fetch   {rel} ({f['size_in_bytes'] / 1e6:.1f} MB)")
        tmp = dest.with_suffix(".part")
        with urllib.request.urlopen(
            urllib.request.Request(BASE + rel, headers=UA), timeout=300
        ) as r:
            tmp.write_bytes(r.read())
        if sha256(tmp) != f["hash"]:
            tmp.unlink()
            print("hash mismatch:", rel, file=sys.stderr)
            return 1
        tmp.replace(dest)
    # The asset names in each file, for build_blend.py to append by name.
    names = {rel: [a["name"] for a in assets if a["files"][0] == rel] for rel in WANTED}
    (args.cache / "assets.json").write_text(json.dumps(names, indent=1))
    print("cache:", args.cache)
    return 0


if __name__ == "__main__":
    sys.exit(main())
