"""Bake the Blender forest floor into a seamless tile for the game's ground.

    Blender -b --factory-startup -P scripts/forest3d/bake_ground.py -- OUT.jpg \
        [--tile 9.0] [--size 1024] [--mean R G B]

The tile is the floor recipe in ground_shader.py without its 20-60 m patches,
which a 9 m tile cannot hold. It is baked unlit as a multiplier: the game draws
its ground as the season's color times this map (World.tsx), so the tile's mean
is set to the old canvas speckle's (--mean, sRGB 0-255), keeping the ground's
overall brightness as it was. Every noise samples a 4-D torus whose two
circumferences are the tile's width, so the tile repeats with no seam.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ground_shader  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :]
ap = argparse.ArgumentParser()
ap.add_argument("out", type=Path)
ap.add_argument(
    "--tile",
    type=float,
    default=9.0,
    help="meters the tile spans (the game repeats it 70 times)",
)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument(
    "--mean",
    type=float,
    nargs=3,
    default=(170.0, 173.0, 153.0),
    help="target sRGB mean: the game's old canvas ground texture (#b2b6a1 with its speckle)",
)
args = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    print("GPU unavailable, baking on CPU:", e)
scene.view_settings.view_transform = "Standard"

bpy.ops.mesh.primitive_plane_add(size=1.0)
plane = bpy.context.object
m = bpy.data.materials.new("floor_bake")
plane.data.materials.append(m)
nt = m.node_tree
nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputMaterial")
emit = nt.nodes.new("ShaderNodeEmission")
nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

# The torus: u and v (0..1) go once round circles of circumference tile meters.
uv = nt.nodes.new("ShaderNodeTexCoord").outputs["UV"]
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(uv, sep.inputs["Vector"])
R = args.tile / (2 * math.pi)


def trig(socket, op):
    turn = nt.nodes.new("ShaderNodeMath")
    turn.operation = "MULTIPLY"
    turn.inputs[1].default_value = 2 * math.pi
    nt.links.new(socket, turn.inputs[0])
    f = nt.nodes.new("ShaderNodeMath")
    f.operation = op
    nt.links.new(turn.outputs[0], f.inputs[0])
    scale = nt.nodes.new("ShaderNodeMath")
    scale.operation = "MULTIPLY"
    scale.inputs[1].default_value = R
    nt.links.new(f.outputs[0], scale.inputs[0])
    return scale.outputs[0]


cu, su = trig(sep.outputs["X"], "COSINE"), trig(sep.outputs["X"], "SINE")
cv, sv = trig(sep.outputs["Y"], "COSINE"), trig(sep.outputs["Y"], "SINE")
vec = nt.nodes.new("ShaderNodeCombineXYZ")
for i, s in enumerate((cu, su, cv)):
    nt.links.new(s, vec.inputs[i])


def noise(scale_m, detail, rough):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.noise_dimensions = "4D"
    n.inputs["Scale"].default_value = 1.0 / scale_m
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(vec.outputs["Vector"], n.inputs["Vector"])
    nt.links.new(sv, n.inputs["W"])
    return n.outputs["Fac"]


# A neutral base: the bake is a multiplier, so its hue comes from the litter and the mean below.
color, _ = ground_shader.floor(nt, (0.5, 0.5, 0.5), noise, patches=False)
nt.links.new(color, emit.inputs["Color"])

img = bpy.data.images.new("floor", args.size, args.size, alpha=False, float_buffer=True)
img.colorspace_settings.name = "Linear Rec.709"
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
nt.nodes.active = tex
plane.select_set(True)
bpy.context.view_layer.objects.active = plane
bpy.ops.object.bake(type="EMIT", margin=0)

px = np.array(img.pixels[:], np.float32).reshape(args.size, args.size, 4)[..., :3]
srgb = np.where(
    px <= 0.0031308, px * 12.92, 1.055 * np.power(np.clip(px, 0, None), 1 / 2.4) - 0.055
)
srgb = np.clip(srgb * 255.0, 0, None)
# Match the old texture's mean per channel, so the season colors land as before.
srgb *= np.array(args.mean) / srgb.reshape(-1, 3).mean(0)
srgb = np.clip(srgb, 0, 255) / 255.0
lin = np.where(srgb <= 0.04045, srgb / 12.92, np.power((srgb + 0.055) / 1.055, 2.4))
img.pixels.foreach_set(
    np.concatenate([lin, np.ones((args.size, args.size, 1), np.float32)], 2).ravel()
)

scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 88
args.out.parent.mkdir(parents=True, exist_ok=True)
img.save_render(str(args.out.resolve()), scene=scene)
print(
    "baked",
    args.out,
    f"{args.size}px over {args.tile} m;",
    "mean sRGB",
    (srgb.reshape(-1, 3).mean(0) * 255).round(1).tolist(),
)
