"""Render a forest .blend into a Looking Glass quilt with its own camera, sun and sky.

Run with quiltwright's Python: python quilt.py SCENE.blend OUT_STEM [PRESET]
The preset defaults to 16-landscape; the cone is capped at 35 degrees on the spec.
"""

import sys
from dataclasses import replace
from quiltwright import QUILT_PRESETS, render_cycles_quilt, save_quilt

blend, stem, preset = (
    sys.argv[1],
    sys.argv[2],
    (sys.argv[3] if len(sys.argv) > 3 else "16-landscape"),
)
spec = replace(QUILT_PRESETS[preset], view_cone=35.0)
quilt = render_cycles_quilt(
    blend,
    spec,
    None,
    samples=64,
    lighting=None,
    view_transform="Standard",
    keep_views=f"{stem}_views",
)
print(save_quilt(quilt, stem, spec))
