"""Render the moon's eight phases into one labelled panel, docs/images/moon_phases.png.

Uses the same maths as the moon in the forest's sky shader (web/src/game/Environment.tsx):
the map lookup, the colour adjustment, the terminator and the earthshine, but not the
game's tone mapping, so the dark side reads brighter here than in the forest. Rerun after
changing either the texture or the shader:

    uv run --with numpy --with pillow python scripts/render_moon_phases.py

The labels use Georgia from macOS's system fonts.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / "web/public/textures/moon/moon_color.jpg"
OUT = ROOT / "docs/images/moon_phases.png"
tex = np.asarray(Image.open(MAP).convert("RGB"), dtype=np.float32) / 255.0
# sRGB -> linear, as the GPU samples an SRGBColorSpace texture.
tex = np.where(tex <= 0.04045, tex / 12.92, ((tex + 0.055) / 1.055) ** 2.4)
H, W, _ = tex.shape


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def moon(elongation, waxing, size=300):
    # Disc coordinates: p.x toward the viewer's right, p.y up, as in the shader.
    ys, xs = np.mgrid[0:size, 0:size]
    px = (xs + 0.5) / size * 2 - 1
    py = 1 - (ys + 0.5) / size * 2
    r2 = px * px + py * py
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    u = 0.5 + np.arctan2(px, np.maximum(z, 1e-4)) / (2 * np.pi)
    v = 0.5 + np.arcsin(np.clip(py, -1, 1)) / np.pi
    col = tex[
        np.clip(((1 - v) * H).astype(int), 0, H - 1),
        np.clip((u * W).astype(int), 0, W - 1),
    ]
    lum = col @ np.array([0.2126, 0.7152, 0.0722])
    albedo = lum[..., None] + (col - lum[..., None]) * 0.5
    albedo = albedo**1.8 * 1.45
    # Sun in the disc's frame: toward the viewer's right while waxing (the lit side faces the
    # evening sun), left while waning. Normal n = (px, py, -z) with the view along +z.
    s = 1 if waxing else -1
    sun = np.array([s * np.sin(elongation), 0.0, np.cos(elongation)])
    ndots = px * sun[0] + py * sun[1] - z * sun[2]
    lit = smoothstep(-0.04, 0.08, ndots)[..., None]
    edge = smoothstep(1.0, 0.85, r2)[..., None]
    sky = np.array([0.012, 0.02, 0.045])
    out = sky + (albedo * 0.1 - sky) * (1 - lit) * edge * 0.75
    out = out + (albedo * 1.05 - out) * lit * edge
    out = np.clip(out, 0, 1)
    out = np.where(out <= 0.0031308, out * 12.92, 1.055 * out ** (1 / 2.4) - 0.055)
    return Image.fromarray((out * 255).astype(np.uint8))


PHASES = [
    ("New moon", 0.0, True),
    ("Waxing crescent", np.pi / 4, True),
    ("First quarter", np.pi / 2, True),
    ("Waxing gibbous", 3 * np.pi / 4, True),
    ("Full moon", np.pi, True),
    ("Waning gibbous", 3 * np.pi / 4, False),
    ("Last quarter", np.pi / 2, False),
    ("Waning crescent", np.pi / 4, False),
]
cell, pad, label = 300, 40, 56
cols, rows = 4, 2
bg = tuple(
    int(round(255 * (1.055 * c ** (1 / 2.4) - 0.055))) for c in (0.012, 0.02, 0.045)
)
img = Image.new(
    "RGB",
    (cols * cell + (cols + 1) * pad, rows * (cell + label) + (rows + 1) * pad + 70),
    bg,
)
d = ImageDraw.Draw(img)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 34)
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 24)
small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 18)
d.text(
    (pad, 24),
    "Knowledge Press Forest: the moon's phases",
    font=title,
    fill=(239, 232, 220),
)
for i, (name, e, waxing) in enumerate(PHASES):
    x = pad + (i % cols) * (cell + pad)
    y = 70 + pad + (i // cols) * (cell + label + pad)
    img.paste(moon(e, waxing, cell), (x, y))
    lit = (1 - np.cos(e)) / 2
    tw = d.textlength(name, font=font)
    d.text((x + (cell - tw) / 2, y + cell + 8), name, font=font, fill=(239, 232, 220))
    sub = f"{lit * 100:.0f}% lit"
    sw = d.textlength(sub, font=small)
    d.text((x + (cell - sw) / 2, y + cell + 36), sub, font=small, fill=(201, 162, 74))
img.save(OUT)
print(f"wrote {OUT.relative_to(ROOT)} {img.size[0]}x{img.size[1]}")
