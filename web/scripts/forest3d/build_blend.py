"""Build a Blender scene of the Knowledge Press forest from export.mjs output.

Run headless with Blender's own Python:

    Blender -b --factory-startup -P scripts/forest3d/build_blend.py -- DATA_DIR OUT.blend \
        --eye X Y Z --target X Y Z [--fov DEG] [--sun-elev DEG] [--sun-az DEG]

Eye and target are three.js coordinates (Y-up), as the game uses. Every
object hangs under one empty rotated +90 degrees about X, so the exported
arrays go in untouched and the scene comes out Z-up. The camera's DoF focus
distance is the eye-to-target distance: quiltwright's Cycles backend takes
the focal plane from it when it adopts the .blend's camera.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
ap = argparse.ArgumentParser()
ap.add_argument("data")
ap.add_argument("out")
ap.add_argument("--eye", type=float, nargs=3, required=True)
ap.add_argument("--target", type=float, nargs=3, required=True)
ap.add_argument(
    "--fov", type=float, default=50.0, help="horizontal field of view, degrees"
)
ap.add_argument("--sun-elev", type=float, default=35.0)
ap.add_argument("--sun-az", type=float, default=135.0)
ap.add_argument("--sun", type=float, default=4.0, help="sun irradiance, W/m^2")
ap.add_argument(
    "--sky",
    type=float,
    default=None,
    help="world strength: 0.08 for the physical sky (fill, with the sun lamp as key), 1 for an HDRI",
)
ap.add_argument("--exposure", type=float, default=0.0)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument(
    "--assets",
    type=Path,
    default=Path.home() / "Library/Caches/knowledge_press/blender-essentials",
    help="cache from fetch_essentials.py (Blender's online Essentials library)",
)
ap.add_argument(
    "--road",
    default="game",
    help='road material: "game" (the game\'s photo brick) or an Essentials brick, e.g. "Bricks - Natural"',
)
ap.add_argument(
    "--world",
    default="sky",
    help='"sky" (physical sky, sun lamp as key) or an Essentials HDRI world: '
    '"Forest Street", "Sunrise", "Sunset", "Night"',
)
ap.add_argument("--world-angle", type=float, default=0.0, help="HDRI rotation, degrees")
args = ap.parse_args(argv)
if args.sky is None:
    args.sky = 0.08 if args.world == "sky" else 1.0

data = Path(args.data)
man = json.loads((data / "manifest.json").read_text())
TEX = Path(man["textures"])
DT = {"Float32Array": np.float32, "Uint32Array": np.uint32}


def arr(name):
    return np.fromfile(data / f"{name}.bin", dtype=DT[man["files"][name]["dtype"]])


def three_to_blender(p):
    x, y, z = p
    return Vector((x, -z, y))


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
root = bpy.data.objects.new("forest_root", None)
root.rotation_euler = (math.pi / 2, 0, 0)
scene.collection.objects.link(root)


def link(obj, parent=root):
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def mesh_from(name, pos, index, uv=None, normal=None):
    """A triangle mesh from flat arrays; per-vertex UVs and normals as the game has them."""
    me = bpy.data.meshes.new(name)
    nv, nt = len(pos) // 3, len(index) // 3
    me.vertices.add(nv)
    me.vertices.foreach_set("co", pos)
    me.loops.add(nt * 3)
    me.loops.foreach_set("vertex_index", index.astype(np.int32))
    me.polygons.add(nt)
    me.polygons.foreach_set("loop_start", np.arange(0, nt * 3, 3, dtype=np.int32))
    if uv is not None:
        me.uv_layers.new(name="UVMap").data.foreach_set(
            "uv", uv.reshape(-1, 2)[index].ravel()
        )
    me.update(calc_edges=True)
    me.validate()
    me.shade_smooth()
    if normal is not None:
        # The game's own normals: smooth round the trunk, no seam where the bark wraps.
        me.normals_split_custom_set_from_vertices(normal.reshape(-1, 3))
    return me


def flat_mesh(name):
    return mesh_from(name, arr(f"{name}_pos"), arr(f"{name}_index"), arr(f"{name}_uv"))


# --- materials -------------------------------------------------------------


def principled(name, roughness):
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    return m, m.node_tree, bsdf


def image_node(nt, path, color=True):
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(path), check_existing=True)
    if not color:
        tex.image.colorspace_settings.name = "Non-Color"
    return tex


def sock(sockets, identifier):
    """A socket by identifier: the Mix node has an A and B per data type, all sharing the names."""
    return next(s for s in sockets if s.identifier == identifier)


def textured(name, color_path, normal_path, roughness, tint=None):
    """Photo texture plus normal map, optionally multiplied by a tint (as three's color x map)."""
    m, nt, bsdf = principled(name, roughness)
    tex = image_node(nt, color_path)
    out = tex.outputs["Color"]
    if tint is not None:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(out, sock(mix.inputs, "A_Color"))
        sock(mix.inputs, "B_Color").default_value = (*tint, 1.0)
        out = sock(mix.outputs, "Result_Color")
    nt.links.new(out, bsdf.inputs["Base Color"])
    nrm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(
        image_node(nt, normal_path, color=False).outputs["Color"], nrm.inputs["Color"]
    )
    nt.links.new(nrm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def instancer_color(name, roughness, attr_name):
    """Base color from each instance's point attribute (geometry-node instances)."""
    m, nt, bsdf = principled(name, roughness)
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_type, a.attribute_name = "INSTANCER", attr_name
    nt.links.new(a.outputs["Color"], bsdf.inputs["Base Color"])
    return m, nt, bsdf


leaf_mat, _, _ = instancer_color("leaf", 0.8, "leafcol")


def redwood_bark_material():
    """Furrowed cinnamon bark in the spirit of CorpusRedwood.tsx's canvas texture:
    meandering vertical ridges (a distorted wave across u), dark furrows, fibre noise."""
    m, nt, bsdf = principled("redwood_bark", 0.95)
    uv = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type, wave.bands_direction = "BANDS", "X"
    wave.inputs["Scale"].default_value = 8.0
    wave.inputs["Distortion"].default_value = 6.0
    wave.inputs["Detail"].default_value = 3.0
    nt.links.new(uv.outputs["UV"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (
        (38 / 255) ** 2.2,
        (17 / 255) ** 2.2,
        (11 / 255) ** 2.2,
        1,
    )
    ramp.color_ramp.elements[1].color = (
        (156 / 255) ** 2.2,
        (74 / 255) ** 2.2,
        (44 / 255) ** 2.2,
        1,
    )
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def spray_material():
    """A flat redwood spray (CorpusRedwood.tsx sprayTexture): a stem along x, short
    needles either side, longest mid-spray; the rest of the card cut away."""
    m, nt, bsdf = instancer_color("redwood_spray", 0.85, "spraycol")
    uv = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
    math_ = lambda op, a, b=None: _math(nt, op, a, b)  # noqa: E731
    u, v = sep.outputs["X"], sep.outputs["Y"]
    # Envelope: half-width of the needles at u, as a fraction of the card (0..0.5).
    env = math_("MULTIPLY", math_("SINE", math_("MULTIPLY", u, math.pi)), 0.42)
    off = math_("ABSOLUTE", math_("SUBTRACT", v, 0.5))
    inside = math_("LESS_THAN", off, env)
    # Needle comb: about 18 needles a side, swept toward the tip, each a little over half its pitch.
    comb = math_(
        "LESS_THAN",
        math_(
            "FRACT",
            math_("MULTIPLY", math_("SUBTRACT", u, math_("MULTIPLY", off, 0.6)), 18.0),
        ),
        0.6,
    )
    stem = math_("LESS_THAN", off, 0.03)
    alpha = math_("MAXIMUM", math_("MULTIPLY", inside, comb), stem)
    nt.links.new(alpha, bsdf.inputs["Alpha"])
    return m


def _math(nt, op, a, b):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            nt.links.new(x, n.inputs[i])
    return n.outputs[0]


# --- instancing --------------------------------------------------------------

protos = bpy.data.collections.new("prototypes")
scene.collection.children.link(protos)


def proto(name, me):
    ob = bpy.data.objects.new(name, me)
    protos.objects.link(ob)
    return ob


def instancer(name, shape):
    """Geometry nodes: one instance of *shape* per point, rotated by the point's
    `rot` quaternion and scaled by its `scl` vector."""
    g = bpy.data.node_groups.new(name, "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket(
        "Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry"
    )
    n, L = g.nodes, g.links
    gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    info = n.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = shape
    inst = n.new("GeometryNodeInstanceOnPoints")
    rot = n.new("GeometryNodeInputNamedAttribute")
    rot.data_type = "QUATERNION"
    rot.inputs["Name"].default_value = "rot"
    scl = n.new("GeometryNodeInputNamedAttribute")
    scl.data_type = "FLOAT_VECTOR"
    scl.inputs["Name"].default_value = "scl"
    L.new(gi.outputs[0], inst.inputs["Points"])
    L.new(info.outputs["Geometry"], inst.inputs["Instance"])
    L.new(rot.outputs["Attribute"], inst.inputs["Rotation"])
    L.new(scl.outputs["Attribute"], inst.inputs["Scale"])
    L.new(inst.outputs["Instances"], go.inputs[0])
    return g


def points(name, prefix, color_attr):
    """A point cloud carrying rot, scl and a color attribute, one point per instance."""
    pos = arr(f"{prefix}_pos")
    n = len(pos) // 3
    pm = bpy.data.meshes.new(name)
    pm.vertices.add(n)
    pm.vertices.foreach_set("co", pos)
    pm.attributes.new("rot", "QUATERNION", "POINT").data.foreach_set(
        "value", arr(f"{prefix}_quat")
    )
    pm.attributes.new("scl", "FLOAT_VECTOR", "POINT").data.foreach_set(
        "vector", arr(f"{prefix}_scale")
    )
    col = arr(f"{prefix}_color").reshape(-1, 3)
    rgba = np.concatenate([col, np.ones((n, 1), np.float32)], axis=1).ravel()
    pm.attributes.new(color_attr, "FLOAT_COLOR", "POINT").data.foreach_set(
        "color", rgba
    )
    return pm, n


# --- book trees ---------------------------------------------------------------

shape_obj = {}
for name in man["leafShapes"]:
    me = mesh_from(f"leaf_{name}", arr(f"shape_{name}_pos"), arr(f"shape_{name}_index"))
    me.materials.append(leaf_mat)
    shape_obj[name] = proto(f"leafshape_{name}", me)

groups, bark_mats = {}, {}
for c in man["chunks"]:
    ci, sp = c["id"], c["species"]
    me = mesh_from(
        f"bark_{ci}",
        arr(f"bark_{ci}_pos"),
        arr(f"bark_{ci}_index"),
        arr(f"bark_{ci}_uv"),
        arr(f"bark_{ci}_normal"),
    )
    if sp not in bark_mats:
        bark_mats[sp] = textured(
            f"bark_{sp}",
            TEX / f"bark/{sp}_color.jpg",
            TEX / f"bark/{sp}_normal.jpg",
            0.92,
            tint=man["barkTint"],
        )
    me.materials.append(bark_mats[sp])
    link(bpy.data.objects.new(f"bark_{ci}_{c['genre']}", me))
    pm, n = points(f"leafpts_{ci}", f"leaf_{ci}", "leafcol")
    if n == 0:
        continue
    ob = link(bpy.data.objects.new(f"leaves_{ci}_{c['genre']}", pm))
    if sp not in groups:
        groups[sp] = instancer(f"leaves_{sp}", shape_obj[sp])
    ob.modifiers.new("leaves", "NODES").node_group = groups[sp]

# --- the corpus redwood --------------------------------------------------------

if man["redwood"]:
    me = mesh_from(
        "redwood_bark",
        arr("redwood_bark_pos"),
        arr("redwood_bark_index"),
        arr("redwood_bark_uv"),
        arr("redwood_bark_normal"),
    )
    me.materials.append(redwood_bark_material())
    link(bpy.data.objects.new("redwood_bark", me))
    card = mesh_from(
        "spray_card",
        arr("spray_card_pos"),
        arr("spray_card_index"),
        arr("spray_card_uv"),
    )
    card.materials.append(spray_material())
    pm, _ = points("redwood_spraypts", "redwood_spray", "spraycol")
    ob = link(bpy.data.objects.new("redwood_sprays", pm))
    ob.modifiers.new("sprays", "NODES").node_group = instancer(
        "redwood_sprays", proto("spray_card", card)
    )

bpy.context.view_layer.layer_collection.children["prototypes"].exclude = True

# --- roads, plazas, grove grounds ---------------------------------------------------

ESSENTIAL_FILES = {
    "material": [
        "materials/materials__bricks.blend",
        "materials/materials__metal.blend",
        "materials/materials__wood.blend",
    ],
    "world": [
        "world_hdri/world_hdris__forest.blend",
        "world_hdri/world_hdris__sunrise.blend",
        "world_hdri/world_hdris__sunset.blend",
        "world_hdri/world_hdris__night.blend",
    ],
}


def essential(kind, name):
    """Append a material or world by name from the fetched Essentials files."""
    for rel in ESSENTIAL_FILES[kind]:
        path = args.assets / rel
        if not path.exists():
            continue
        with bpy.data.libraries.load(str(path)) as (src, dst):
            found = name in (src.materials if kind == "material" else src.worlds)
            if found and kind == "material":
                dst.materials = [name]
            elif found:
                dst.worlds = [name]
        if found:
            return (bpy.data.materials if kind == "material" else bpy.data.worlds)[name]
    sys.exit(f"{kind} {name!r} not in {args.assets}; run fetch_essentials.py")


BRICK_TILE = 2.4  # roads.ts: road UVs are (x, z) / BRICK_TILE


def essential_brick(name):
    """An Essentials brick, laid flat on the road: its pattern is in meters, so feed it
    the road's UVs scaled back to ground meters (the roads lie in three.js's XZ plane)."""
    m = essential("material", name)
    nt = m.node_tree
    group = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeGroup")
    uv = nt.nodes.new("ShaderNodeUVMap")
    scale = nt.nodes.new("ShaderNodeVectorMath")
    scale.operation = "SCALE"
    scale.inputs["Scale"].default_value = BRICK_TILE
    nt.links.new(uv.outputs["UV"], scale.inputs[0])
    nt.links.new(scale.outputs["Vector"], group.inputs["Vector"])
    return m


if man["roads"]:
    if args.road == "game":
        brick = textured(
            "brick", TEX / "road/brick_color.jpg", TEX / "road/brick_normal.jpg", 0.9
        )
    else:
        brick = essential_brick(args.road)
    for name in man["roads"]:
        me = flat_mesh(name)
        me.materials.append(brick)
        link(bpy.data.objects.new(name, me))

for g in man["groves"]:
    me = flat_mesh(g["name"])
    me.attributes.new("fade", "FLOAT", "POINT").data.foreach_set(
        "value", arr(f"{g['name']}_alpha")
    )
    m, nt, bsdf = principled(f"ground_{g['genre']}", 1.0)
    bsdf.inputs["Base Color"].default_value = (*g["color"], 1)
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_name = "fade"
    nt.links.new(a.outputs["Fac"], bsdf.inputs["Alpha"])
    me.materials.append(m)
    ob = link(bpy.data.objects.new(g["name"], me))
    ob.visible_shadow = False  # a tint on the ground, not a thing

# The ground: the season's day color, speckled like the game's canvas texture.
gm, gnt, gbsdf = principled("ground", 0.96)
noise = gnt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 400.0
mix = gnt.nodes.new("ShaderNodeMix")
mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
mix.inputs["Factor"].default_value = 0.35
gnt.links.new(noise.outputs["Fac"], sock(mix.inputs, "B_Color"))
# three multiplies the color by its canvas texture, #b2b6a1 under the speckle: about this, linear.
GROUND_MAP = (0.445, 0.468, 0.356)
sock(mix.inputs, "A_Color").default_value = (
    *(c * m for c, m in zip(man["ground"], GROUND_MAP)),
    1,
)
gnt.links.new(sock(mix.outputs, "Result_Color"), gbsdf.inputs["Base Color"])
reg = man["region"]
if reg:  # a region stands on its own round plinth, a diorama
    bpy.ops.mesh.primitive_circle_add(
        vertices=128,
        radius=reg["r"],
        fill_type="NGON",
        location=three_to_blender((reg["x"], 0, reg["z"])),
    )
else:
    bpy.ops.mesh.primitive_circle_add(
        vertices=128, radius=man["worldRadius"] + 30, fill_type="NGON"
    )
bpy.context.object.name = "ground"
bpy.context.object.data.materials.append(gm)

# --- light, sky, camera ------------------------------------------------------

el, az = math.radians(args.sun_elev), math.radians(args.sun_az)
sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = args.sun
sun_data.angle = math.radians(1.0)
sun = bpy.data.objects.new("sun", sun_data)
sun.rotation_euler = (math.pi / 2 - el, 0, az)
scene.collection.objects.link(sun)


def physical_sky(nt, strength):
    """A Background shader of Blender's physical sky, its own sun disc off (the lamp is the sun)."""
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    try:
        sky = nt.nodes.new("ShaderNodeTexSky")
        sky.sun_elevation, sky.sun_rotation = el, az
        if hasattr(sky, "sun_disc"):
            sky.sun_disc = False
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    except Exception as e:  # sky model names change across Blender versions
        print("sky texture unavailable:", e)
        bg.inputs["Color"].default_value = (0.45, 0.6, 0.85, 1)
    return bg.outputs["Background"]


if args.world == "sky":
    world = bpy.data.worlds.new("sky")
    nt = world.node_tree
    out = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputWorld")
    nt.links.new(physical_sky(nt, args.sky), out.inputs["Surface"])
else:
    # An Essentials HDRI lights the scene; the camera sees the physical sky instead
    # of the HDRI's photograph (a city square or a real forest behind the diorama).
    world = essential("world", args.world)
    nt = world.node_tree
    for n in nt.nodes:
        if n.bl_idname == "ShaderNodeGroup" and "Angle" in n.inputs:
            n.inputs["Angle"].default_value = math.radians(args.world_angle)
        if n.bl_idname == "ShaderNodeBackground":
            n.inputs["Strength"].default_value = args.sky
    out = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputWorld")
    hdri = out.inputs["Surface"].links[0].from_socket
    mix = nt.nodes.new("ShaderNodeMixShader")
    path = nt.nodes.new("ShaderNodeLightPath")
    nt.links.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(hdri, mix.inputs[1])
    nt.links.new(physical_sky(nt, 0.08), mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
scene.world = world

cam_data = bpy.data.cameras.new("camera")
cam_data.sensor_fit = "HORIZONTAL"
cam_data.angle = math.radians(args.fov)
cam_data.clip_start, cam_data.clip_end = 0.1, 2000
cam = bpy.data.objects.new("camera", cam_data)
eye, target = three_to_blender(args.eye), three_to_blender(args.target)
cam.location = eye
cam.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()
cam_data.dof.focus_distance = (target - eye).length
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = args.exposure
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    print("GPU unavailable:", e)

bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.out).resolve()))
print("saved", args.out, "groves", len(man["chunks"]), "redwood", bool(man["redwood"]))
