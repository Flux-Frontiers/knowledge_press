"""Download the Poly Haven textures the forest uses into a local cache.

Poly Haven (https://polyhaven.com) publishes every asset CC0. Each file is
checked against the MD5 the Poly Haven API lists, and skipped if the cached copy
already matches.

    python3 scripts/forest3d/fetch_polyhaven.py [--cache DIR] [--res 2k]

Files land as DIR/<asset>/<map>_<res>.jpg (map: diff, nor_gl, rough). The
default cache is ~/Library/Caches/knowledge_press/polyhaven; build_blend.py
reads it with --polyhaven DIR.
"""

import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

API = "https://api.polyhaven.com/files/"
UA = {"User-Agent": "knowledge-press-forest3d"}
# asset -> what it is for
ASSETS = {
    "forrest_ground_01": "the forest floor: grass, twigs and leaf litter (2 m square)",
    "leaves_forest_ground": "autumn's floor: fallen leaves (1.26 m square)",
    "metasequoia_bark": "the corpus redwood: dawn-redwood bark (1.94 m square)",
}
MAPS = {"Diffuse": "diff", "nor_gl": "nor_gl", "Rough": "rough"}


def get(url, timeout=120):
    with urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=timeout
    ) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "--cache",
        type=Path,
        default=Path.home() / "Library/Caches/knowledge_press/polyhaven",
    )
    ap.add_argument("--res", default="2k", help="1k, 2k, 4k or 8k")
    args = ap.parse_args()
    for asset in ASSETS:
        files = json.loads(get(API + asset))
        for key, short in MAPS.items():
            f = files[key][args.res]["jpg"]
            dest = args.cache / asset / f"{short}_{args.res}.jpg"
            if dest.exists() and hashlib.md5(dest.read_bytes()).hexdigest() == f["md5"]:
                print("cached ", dest.relative_to(args.cache))
                continue
            data = get(f["url"], timeout=300)
            if hashlib.md5(data).hexdigest() != f["md5"]:
                print("md5 mismatch:", f["url"], file=sys.stderr)
                return 1
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            print(f"fetch   {dest.relative_to(args.cache)} ({len(data) / 1e6:.1f} MB)")
    print("cache:", args.cache)
    return 0


if __name__ == "__main__":
    sys.exit(main())
