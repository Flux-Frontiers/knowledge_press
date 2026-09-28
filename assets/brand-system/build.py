# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools", "uharfbuzz"]
# ///
# © 2026 Eric G. Suchanek, PhD -- Flux-Frontiers -- SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
"""Build the Knowledge Press brand SVGs around the press seal.

Traces the KP ligature from fonts/Merriweather-Bold.ttf (SIL OFL 1.1) and
writes it into the seal wherever the seal is drawn: every SVG in this
folder except colors.css, the app icon sources app/icon/press-seal.svg and
press-seal-macos.svg, and web/public/favicon.svg. The name is the same face,
kerned by HarfBuzz and traced to outlines. Run `make icons` afterwards to
re-render the app icon PNGs. See README.md for how to run it.
"""

import re
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "assets/brand-system"
FONT = str(OUT / "fonts/Merriweather-Bold.ttf")

INK, RING, SEAL, PAPER = "#151b29", "#237f59", "#2dcc78", "#f4f0dc"
R, D = 347, 694  # seal radius and diameter, in the app icon's 1024 space

# The KP: cap height on the 1024 grid, and how far the P's left serifs
# overlap the K's right edge, in ems. At 0.10 the K's arm and leg serifs land
# on the P's stem and the letters stay distinct.
KP_CAP, KP_OVERLAP = 260, 0.10

# The seal is drawn in these files too; build.py rewrites the KP path in each.
SEAL_FILES = [
    "app/icon/press-seal.svg",
    "app/icon/press-seal-macos.svg",
    "web/public/favicon.svg",
]

font = TTFont(FONT)
gs = font.getGlyphSet()
order = font.getGlyphOrder()
cmap = font.getBestCmap()
UPM = font["head"].unitsPerEm
blob = hb.Blob.from_file_path(FONT)
hbfont = hb.Font(hb.Face(blob))


def fmt(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def glyph_bounds(ch):
    b = BoundsPen(gs)
    gs[cmap[ord(ch)]].draw(b)
    return b.bounds


CAP = glyph_bounds("K")[3]  # cap height, font units


def kp_path():
    """The KP ligature, centered on the seal at 512, 512."""
    bk, bp = glyph_bounds("K"), glyph_bounds("P")
    p_at = bk[2] - bp[0] - KP_OVERLAP * UPM
    x0, x1 = bk[0], p_at + bp[2]
    s = KP_CAP / CAP
    tx = 512 - (x1 - x0) * s / 2 - x0 * s
    pen = SVGPathPen(gs, ntos=fmt)
    for ch, at in (("K", 0), ("P", p_at)):
        m = (s, 0, 0, -s, tx + at * s, 512 + KP_CAP / 2)
        gs[cmap[ord(ch)]].draw(TransformPen(pen, m))
    return pen.getCommands()


KP = kp_path()


def text_path(text, size, x, baseline):
    """Merriweather Bold outlines for text, kerned by HarfBuzz; returns (d, bounds)."""
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    k = size / UPM
    pen = SVGPathPen(gs, ntos=fmt)
    bounds = BoundsPen(gs)
    pen_x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        m = (k, 0, 0, -k, x + (pen_x + pos.x_offset) * k, baseline - pos.y_offset * k)
        gs[name].draw(TransformPen(pen, m))
        gs[name].draw(TransformPen(bounds, m))
        pen_x += pos.x_advance
    return pen.getCommands(), bounds.bounds


def seal(cx, cy, scale=1.0):
    """The full-color seal, centered at (cx, cy)."""
    t = f"translate({fmt(cx)} {fmt(cy)}) scale({fmt(scale)}) translate(-512 -512)"
    return (
        f'<g transform="{t}">'
        f'<circle cx="512" cy="512" r="347" fill="{RING}"/>'
        f'<circle cx="512" cy="512" r="313" fill="none" stroke="{PAPER}" stroke-width="17"/>'
        f'<circle cx="512" cy="512" r="273" fill="{SEAL}"/>'
        f'<path fill="{INK}" d="{KP}"/></g>'
    )


def svg(w, h, body, label, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}" '
        f'role="img" aria-label="{label}">\n'
        + (f"  <defs>{defs}</defs>\n" if defs else "")
        + f"  {body}\n</svg>\n"
    )


def write(name, text):
    (OUT / name).write_text(text)
    print("wrote", name)


# The KP wherever else the seal is drawn: the app icon sources and the favicon.
for rel in SEAL_FILES:
    path = REPO / rel
    text, n = re.subn(
        r'(<path fill="#151b29" d=")[^"]*(")', rf"\g<1>{KP}\g<2>", path.read_text()
    )
    if n != 1:
        raise SystemExit(f"{rel}: expected one KP path, found {n}")
    path.write_text(text)
    print("wrote", rel)

# The seal, cropped to its circle.
write("seal.svg", svg(D, D, seal(R, R), "The Knowledge Press seal"))

# One-color seals: the rule and the KP knocked out of a solid disc.
for name, color in (("seal-ink.svg", INK), ("seal-paper.svg", PAPER)):
    mask = (
        '<mask id="knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">'
        '<rect width="1024" height="1024" fill="#fff"/>'
        '<circle cx="512" cy="512" r="313" fill="none" stroke="#000" stroke-width="17"/>'
        f'<path fill="#000" d="{KP}"/></mask>'
    )
    body = (
        f'<g transform="translate(-165 -165)"><circle cx="512" cy="512" r="347" '
        f'fill="{color}" mask="url(#knockout)"/></g>'
    )
    write(name, svg(D, D, body, "The Knowledge Press seal, one color", mask))

NAME = "The Knowledge Press"

# Wordmark alone, trimmed to its ink.
WM_SIZE = 300
d, (x0, y0, x1, y1) = text_path(NAME, WM_SIZE, 0, 0)
for name, color in (("wordmark-ink.svg", INK), ("wordmark-paper.svg", PAPER)):
    body = (
        f'<path fill="{color}" transform="translate({fmt(-x0)} {fmt(-y0)})" d="{d}"/>'
    )
    write(name, svg(x1 - x0, y1 - y0, body, NAME))

# Horizontal lockup: caps 30% of the seal's diameter, centered on it.
cap = 0.30 * D
size = cap * UPM / CAP
gap = 0.18 * D
baseline = R + cap / 2
d, (x0, y0, x1, y1) = text_path(NAME, size, 0, baseline)
dx = D + gap - x0
for name, color in (
    ("lockup-horizontal-ink.svg", INK),
    ("lockup-horizontal-paper.svg", PAPER),
):
    body = (
        seal(R, R)
        + f'<path fill="{color}" transform="translate({fmt(dx)} 0)" d="{d}"/>'
    )
    write(name, svg(D + gap + (x1 - x0), max(D, y1), body, NAME))

# Stacked lockup: the name as wide as 1.8 seal diameters, under the seal.
d, (x0, y0, x1, y1) = text_path(NAME, 100, 0, 0)
size = 100 * 1.8 * D / (x1 - x0)
cap = CAP * size / UPM
top = D + 0.14 * D
d, (x0, y0, x1, y1) = text_path(NAME, size, 0, top + cap)
w = x1 - x0
for name, color in (
    ("lockup-stacked-ink.svg", INK),
    ("lockup-stacked-paper.svg", PAPER),
):
    body = (
        seal(w / 2, R)
        + f'<path fill="{color}" transform="translate({fmt(-x0)} 0)" d="{d}"/>'
    )
    write(name, svg(w, y1, body, NAME))
