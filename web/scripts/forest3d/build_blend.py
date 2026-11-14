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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ground_shader  # noqa: E402  (the floor recipe, shared with bake_ground.py)

argv = sys.argv[sys.argv.index("--") + 1 :]
ap = argparse.ArgumentParser()
ap.add_argument("data")
ap.add_argument("out")
ap.add_argument("--eye", type=float, nargs=3, required=True)
ap.add_argument("--target", type=float, nargs=3, required=True)
ap.add_argument(
    "--fov", type=float, default=50.0, help="horizontal field of view, degrees"
)
ap.add_argument(
    "--sun-elev",
    type=float,
    default=None,
    help="override the exported sky's sun altitude, degrees",
)
ap.add_argument(
    "--sun-az",
    type=float,
    default=None,
    help="override the sun's azimuth, degrees (with --sun-elev)",
)
ap.add_argument(
    "--sun",
    type=float,
    default=None,
    help="sun irradiance, W/m^2 (default: the preset's)",
)
ap.add_argument(
    "--sun-kelvin",
    type=float,
    default=None,
    help="sun color temperature (default: the preset's)",
)
ap.add_argument(
    "--sky",
    type=float,
    default=None,
    help="world strength: 0.08 for the physical sky (fill, with the sun lamp as key), 1 for an HDRI",
)
ap.add_argument("--exposure", type=float, default=None, help="default: the preset's")
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
ap.add_argument(
    "--grass",
    type=float,
    default=0.0,
    help="scatter grass tufts within this many meters of the point below the camera (0: none)",
)
ap.add_argument(
    "--redwood-bark",
    choices=["photo", "game"],
    default=None,
    help="the corpus redwood's bark: Poly Haven's metasequoia photo (default when fetched) or the game's own",
)
ap.add_argument(
    "--polyhaven",
    type=Path,
    default=Path.home() / "Library/Caches/knowledge_press/polyhaven",
    help="cache from fetch_polyhaven.py",
)
ap.add_argument(
    "--grass-density",
    type=float,
    default=30.0,
    help="tufts per square meter at the center",
)
args = ap.parse_args(argv)

data = Path(args.data)
man = json.loads((data / "manifest.json").read_text())
TEX = Path(man["textures"])

# Light per time of day, calibrated by measuring the overview render (README, "Light and
# exposure"): sun irradiance, its color temperature, the physical sky's strength, exposure.
# The game's own dawn and dusk light (#ff9a52) is far more saturated than this; these aim
# for a warm but not orange ground (red/blue about 1.5 to 1.7 on the overview's grass).
PRESETS = {
    "noon": dict(sun=4.0, kelvin=5800, sky=0.08, exposure=0.0, ambient=0.0),
    "sunrise": dict(sun=6.0, kelvin=3600, sky=0.10, exposure=1.0, ambient=0.0),
    "sunset": dict(sun=6.0, kelvin=3200, sky=0.10, exposure=1.0, ambient=0.0),
    # Night: the moon lamp (when the moon is up) plus a faint blue ambient for the night sky's glow.
    "night": dict(sun=0.0, kelvin=5800, sky=0.0, exposure=3.0, ambient=0.004),
}
SKY = man.get("sky")
preset = PRESETS.get(SKY["time"] if SKY else "noon", PRESETS["noon"])
for key in ("sun", "sky", "exposure"):
    if getattr(args, key) is None:
        setattr(
            args, key, preset[key] if (key != "sky" or args.world == "sky") else 1.0
        )
if args.sun_kelvin is None:
    args.sun_kelvin = preset["kelvin"]
DT = {
    "Float32Array": np.float32,
    "Uint32Array": np.uint32,
    "Uint8ClampedArray": np.uint8,
}


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


def image_from_rgba(name, rgba, width, height, color=True):
    """A packed Blender image from 8-bit RGBA rows, top row first (a canvas's order). Blender
    stores rows bottom first, which is also how three uploads a canvas (flipY), so the UVs agree."""
    px = rgba.reshape(height, width, 4)[::-1].astype(np.float32) / 255.0
    im = bpy.data.images.new(name, width, height, alpha=True)
    if not color:
        im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(px.ravel())
    im.pack()
    return im


REDWOOD_BARK_TILE_M = 2.4  # corpusTree.ts REDWOOD_BARK.tile
METASEQUOIA_M = 1.94  # Poly Haven metasequoia_bark's real width


def redwood_bark_material():
    """The corpus redwood's bark: Poly Haven's metasequoia (dawn redwood) photograph at its
    true size when fetch_polyhaven.py has cached it, else the game's own bark
    (redwoodTextures.ts, color and normal map, tiled by the bark's UVs as the game tiles
    them). --redwood-bark picks one."""
    if args.redwood_bark is None:
        fetched = (args.polyhaven / "metasequoia_bark" / "diff_2k.jpg").exists()
        args.redwood_bark = "photo" if fetched else "game"
    m, nt, bsdf = principled("redwood_bark", 0.95)
    if args.redwood_bark == "photo":
        ph = args.polyhaven / "metasequoia_bark"
        color, normal = (
            image_node(nt, ph / "diff_2k.jpg"),
            image_node(nt, ph / "nor_gl_2k.jpg", color=False),
        )
        # The redwood's UVs (growTree.ts emitBark with corpusTree.ts REDWOOD_BARK) make one
        # unit 2.4 m round the trunk and twice that up it, for the game's 1:2 bark image.
        # The photo is a 1.94 m square, so scale it to its true size both ways.
        k = REDWOOD_BARK_TILE_M / METASEQUOIA_M
        uvmap = nt.nodes.new("ShaderNodeUVMap")
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (k, 2 * k, 1)
        nt.links.new(uvmap.outputs["UV"], mapping.inputs["Vector"])
        for tex in (color, normal):
            nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    else:
        w, h = man["redwood"]["barkSize"]
        color = nt.nodes.new("ShaderNodeTexImage")
        color.image = image_from_rgba(
            "redwood_bark_color", arr("redwood_bark_color"), w, h
        )
        normal = nt.nodes.new("ShaderNodeTexImage")
        normal.image = image_from_rgba(
            "redwood_bark_normal", arr("redwood_bark_normalmap"), w, h, color=False
        )
    nt.links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    nrm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(normal.outputs["Color"], nrm.inputs["Color"])
    nt.links.new(nrm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def spray_material():
    """The game's own redwood spray (redwoodTextures.ts strokes): a near-white card tinted
    by each spray's color, the card's empty ground cut away (the game's alphaTest 0.5)."""
    m, nt, bsdf = instancer_color("redwood_spray", 0.85, "spraycol")
    tint = bsdf.inputs["Base Color"].links[0].from_socket
    w, h = man["redwood"]["spraySize"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image_from_rgba("redwood_spray", arr("redwood_spray_rgba"), w, h)
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
    sock(mul.inputs, "Factor_Float").default_value = 1.0
    nt.links.new(tex.outputs["Color"], sock(mul.inputs, "A_Color"))
    nt.links.new(tint, sock(mul.inputs, "B_Color"))
    nt.links.new(sock(mul.outputs, "Result_Color"), bsdf.inputs["Base Color"])
    cut = nt.nodes.new("ShaderNodeMath")
    cut.operation = "GREATER_THAN"
    cut.inputs[1].default_value = 0.5
    nt.links.new(tex.outputs["Alpha"], cut.inputs[0])
    nt.links.new(cut.outputs[0], bsdf.inputs["Alpha"])
    return m


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

# --- the floor litter: the game's own grass tufts and rocks (forestFloor.ts) ----------------

if man.get("litter", {}).get("grass"):
    tuft = mesh_from("game_tuft", arr("tuft_pos"), arr("tuft_index"))
    shade = arr("tuft_color").reshape(-1, 3)
    tuft.attributes.new("shade", "FLOAT_COLOR", "POINT").data.foreach_set(
        "color",
        np.concatenate([shade, np.ones((len(shade), 1), np.float32)], 1).ravel(),
    )
    m, nt, bsdf = instancer_color("game_grass", 1.0, "litcol")
    # The game's tuft is dark at the root and light at the tip (its vertex colors), times the tuft's color.
    vcol = nt.nodes.new("ShaderNodeAttribute")
    vcol.attribute_name = "shade"
    tint = bsdf.inputs["Base Color"].links[0].from_socket
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
    sock(mul.inputs, "Factor_Float").default_value = 1.0
    nt.links.new(tint, sock(mul.inputs, "A_Color"))
    nt.links.new(vcol.outputs["Color"], sock(mul.inputs, "B_Color"))
    nt.links.new(sock(mul.outputs, "Result_Color"), bsdf.inputs["Base Color"])
    tuft.materials.append(m)
    pm, _ = points("game_grass_pts", "grass", "litcol")
    ob = link(bpy.data.objects.new("game_grass", pm))
    ob.modifiers.new("tufts", "NODES").node_group = instancer(
        "game_grass", proto("game_tuft", tuft)
    )

if man.get("litter", {}).get("rocks"):
    rock = mesh_from("game_rock", arr("rock_pos"), arr("rock_index"), arr("rock_uv"))
    rock.shade_flat()  # the game's rock is faceted (unindexed, flat normals)
    m, nt, bsdf = instancer_color("game_rock", 0.95, "litcol")
    tint = bsdf.inputs["Base Color"].links[0].from_socket
    tex = image_node(nt, TEX / "rock/rock_color.jpg")
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
    sock(mul.inputs, "Factor_Float").default_value = 1.0
    nt.links.new(tex.outputs["Color"], sock(mul.inputs, "A_Color"))
    nt.links.new(tint, sock(mul.inputs, "B_Color"))
    nt.links.new(sock(mul.outputs, "Result_Color"), bsdf.inputs["Base Color"])
    nrm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(
        image_node(nt, TEX / "rock/rock_normal.jpg", color=False).outputs["Color"],
        nrm.inputs["Color"],
    )
    nt.links.new(nrm.outputs["Normal"], bsdf.inputs["Normal"])
    rock.materials.append(m)
    pm, _ = points("game_rock_pts", "rocks", "litcol")
    ob = link(bpy.data.objects.new("game_rocks", pm))
    ob.modifiers.new("rocks", "NODES").node_group = instancer(
        "game_rocks", proto("game_rock", rock)
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

# three multiplies the ground color by its canvas texture, #b2b6a1 under the speckle: about this, linear.
GROUND_MAP = (0.445, 0.468, 0.356)
GROUND = tuple(c * m for c, m in zip(man["ground"], GROUND_MAP))


def ground_material(name, tint=None):
    """The forest floor: the season's ground color, varied at three scales in world meters
    (so it reads the same on the 600 m world disc and a 15 m plinth). 20-60 m patches drift
    between greener and drier grass; 1-3 m mottling; centimeter litter, which also gives
    the bump (bump only: the roads sit just 3.5 to 5.5 cm above the ground). A grove's
    ground uses the same floor pulled 40% toward its genre color, as the game tints it."""
    m, nt, bsdf = principled(name, 0.95)
    L = nt.links
    pos = nt.nodes.new("ShaderNodeNewGeometry").outputs["Position"]

    def noise(scale_m, detail, rough):
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = 1.0 / scale_m
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        L.new(pos, n.inputs["Vector"])
        return n.outputs["Fac"]

    base = (
        GROUND
        if tint is None
        else tuple(g + (t - g) * 0.4 for g, t in zip(GROUND, tint))
    )
    color, litter_fac = ground_shader.floor(nt, base, noise)
    L.new(color, bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    bump.inputs["Distance"].default_value = 0.01
    L.new(litter_fac, bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m, nt, bsdf


for g in man["groves"]:
    me = flat_mesh(g["name"])
    me.attributes.new("fade", "FLOAT", "POINT").data.foreach_set(
        "value", arr(f"{g['name']}_alpha")
    )
    m, nt, bsdf = ground_material(f"ground_{g['genre']}", tint=g["color"])
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_name = "fade"
    # The exported fade carries the game's 0.6 opacity; the floor itself is now textured,
    # so the patch is opaque where the game's tint is fully on.
    full = nt.nodes.new("ShaderNodeMath")
    full.operation, full.use_clamp = "DIVIDE", True
    full.inputs[1].default_value = 0.6
    nt.links.new(a.outputs["Fac"], full.inputs[0])
    nt.links.new(full.outputs[0], bsdf.inputs["Alpha"])
    me.materials.append(m)
    ob = link(bpy.data.objects.new(g["name"], me))
    ob.visible_shadow = False  # a tint on the ground, not a thing

gm, _, _ = ground_material("ground")
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

# The game's tuft colors by season (Environment.tsx ForestFloor).
GRASS_COLOR = {
    "spring": "#637747",
    "summer": "#637747",
    "autumn": "#9a793e",
    "winter": "#c1bca1",
}


def srgb_hex(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def tuft_mesh():
    """Seven curved, tapering blades from one root, about 0.4 m tall, in Blender axes."""
    rng = np.random.default_rng(7)
    verts, faces = [], []
    for b in range(7):
        ang = rng.uniform(0, 2 * math.pi)
        lean = rng.uniform(0.15, 0.45)
        h = rng.uniform(0.25, 0.45)
        w = rng.uniform(0.012, 0.02)
        dx, dy = math.cos(ang), math.sin(ang)
        px, py = -dy, dx  # across the blade
        first = len(verts)
        for k in range(5):
            t = k / 4
            out = lean * h * t * t
            half = w * (1 - t) + 0.001
            cx, cy, cz = dx * out, dy * out, h * t
            verts += [
                (cx - px * half, cy - py * half, cz),
                (cx + px * half, cy + py * half, cz),
            ]
        for k in range(4):
            i = first + 2 * k
            faces.append((i, i + 1, i + 3, i + 2))
    me = bpy.data.meshes.new("tuft")
    me.from_pydata(verts, [], faces)
    me.shade_smooth()
    return me


def grass(center, radius):
    """Tufts scattered on a disc round *center* (Blender axes, ground level), thinning to a
    quarter at the rim and kept off the roads and plazas, colored as the game's season."""
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=48,
        y_subdivisions=48,
        size=2 * radius,
        location=(center.x, center.y, 0.0),
    )
    patch = bpy.context.object
    patch.name = "grass_patch"
    mat, nt, bsdf = principled("grass", 0.6)
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_type, a.attribute_name = "INSTANCER", "shade"
    base = srgb_hex(GRASS_COLOR.get(man["season"], "#637747"))
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].color = (*(c * 0.7 for c in base), 1)
    r.color_ramp.elements[1].color = (*(min(1.0, c * 1.35) for c in base), 1)
    nt.links.new(a.outputs["Fac"], r.inputs["Fac"])
    nt.links.new(r.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Transmission Weight"].default_value = 0.0
    tuft = tuft_mesh()
    tuft.materials.append(mat)
    tuft_ob = proto("tuft", tuft)

    g = bpy.data.node_groups.new("grass", "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket(
        "Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry"
    )
    n, L = g.nodes, g.links
    gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    # Density: full at the center, a quarter at the rim (distance in the patch's own space).
    pos = n.new("GeometryNodeInputPosition")
    dist = n.new("ShaderNodeVectorMath")
    dist.operation = "LENGTH"
    L.new(pos.outputs[0], dist.inputs[0])
    fall = n.new("ShaderNodeMapRange")
    fall.inputs["From Min"].default_value, fall.inputs["From Max"].default_value = (
        0.0,
        radius,
    )
    fall.inputs["To Min"].default_value, fall.inputs["To Max"].default_value = 1.0, 0.25
    L.new(dist.outputs["Value"], fall.inputs["Value"])
    inside = n.new("FunctionNodeCompare")
    inside.data_type, inside.operation = "FLOAT", "LESS_THAN"
    inside.inputs["B"].default_value = radius
    L.new(dist.outputs["Value"], inside.inputs["A"])
    scatter = n.new("GeometryNodeDistributePointsOnFaces")
    # In Random mode the density is itself a field: the center's density times the falloff.
    # Patchy, as real grass is: a 3 m noise thins some places to nothing and thickens others.
    tex = n.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 1 / 3.0
    tex.inputs["Detail"].default_value = 2.0
    world_pos = n.new("ShaderNodeVectorMath")
    world_pos.operation = "ADD"
    world_pos.inputs[1].default_value = (center.x, center.y, 0.0)
    L.new(pos.outputs[0], world_pos.inputs[0])
    L.new(world_pos.outputs[0], tex.inputs["Vector"])
    clumps = n.new("ShaderNodeMapRange")
    clumps.inputs["From Min"].default_value, clumps.inputs["From Max"].default_value = (
        0.4,
        0.65,
    )
    L.new(tex.outputs["Fac"], clumps.inputs["Value"])
    patchy = n.new("ShaderNodeMath")
    patchy.operation = "MULTIPLY"
    L.new(fall.outputs["Result"], patchy.inputs[0])
    L.new(clumps.outputs["Result"], patchy.inputs[1])
    dens = n.new("ShaderNodeMath")
    dens.operation = "MULTIPLY"
    dens.inputs[1].default_value = args.grass_density
    L.new(patchy.outputs[0], dens.inputs[0])
    scatter.inputs["Seed"].default_value = 3
    L.new(gi.outputs[0], scatter.inputs["Mesh"])
    L.new(dens.outputs[0], scatter.inputs["Density"])
    L.new(inside.outputs["Result"], scatter.inputs["Selection"])
    pts = scatter.outputs["Points"]
    # Off the roads, plazas and the plinth's edge: drop points near any road surface.
    roads = [o for o in bpy.data.objects if o.name.startswith("road_")]
    if roads:
        join = n.new("GeometryNodeJoinGeometry")
        for ro in roads:
            info = n.new("GeometryNodeObjectInfo")
            info.transform_space = "RELATIVE"
            info.inputs["Object"].default_value = ro
            L.new(info.outputs["Geometry"], join.inputs[0])
        prox = n.new("GeometryNodeProximity")
        L.new(join.outputs[0], prox.inputs[0])
        near = n.new("FunctionNodeCompare")
        near.data_type, near.operation = "FLOAT", "LESS_THAN"
        near.inputs["B"].default_value = 0.25
        L.new(prox.outputs["Distance"], near.inputs["A"])
        drop = n.new("GeometryNodeDeleteGeometry")
        drop.domain = "POINT"
        L.new(pts, drop.inputs["Geometry"])
        L.new(near.outputs["Result"], drop.inputs["Selection"])
        pts = drop.outputs["Geometry"]
    if man["region"]:
        reg = man["region"]
        c = three_to_blender((reg["x"], 0, reg["z"]))
        rel = n.new("ShaderNodeVectorMath")
        rel.operation = "DISTANCE"
        rel.inputs[1].default_value = (c.x - center.x, c.y - center.y, 0.0)
        L.new(pos.outputs[0], rel.inputs[0])
        off = n.new("FunctionNodeCompare")
        off.data_type, off.operation = "FLOAT", "GREATER_THAN"
        off.inputs["B"].default_value = reg["r"] - 0.3
        L.new(rel.outputs["Value"], off.inputs["A"])
        drop2 = n.new("GeometryNodeDeleteGeometry")
        drop2.domain = "POINT"
        L.new(pts, drop2.inputs["Geometry"])
        L.new(off.outputs["Result"], drop2.inputs["Selection"])
        pts = drop2.outputs["Geometry"]
    shade = n.new("FunctionNodeRandomValue")
    shade.data_type = "FLOAT"
    store = n.new("GeometryNodeStoreNamedAttribute")
    store.data_type, store.domain = "FLOAT", "POINT"
    store.inputs["Name"].default_value = "shade"
    L.new(pts, store.inputs["Geometry"])
    L.new(shade.outputs["Value"], store.inputs["Value"])
    turn = n.new("FunctionNodeRandomValue")
    turn.data_type = "FLOAT_VECTOR"
    turn.inputs["Max"].default_value = (0.15, 0.15, 2 * math.pi)
    size = n.new("FunctionNodeRandomValue")
    size.data_type = "FLOAT"
    size.inputs["Min"].default_value, size.inputs["Max"].default_value = 0.35, 1.1
    info = n.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = tuft_ob
    inst = n.new("GeometryNodeInstanceOnPoints")
    L.new(store.outputs["Geometry"], inst.inputs["Points"])
    L.new(info.outputs["Geometry"], inst.inputs["Instance"])
    L.new(turn.outputs["Value"], inst.inputs["Rotation"])
    L.new(size.outputs["Value"], inst.inputs["Scale"])
    L.new(inst.outputs["Instances"], go.inputs[0])
    mod = patch.modifiers.new("grass", "NODES")
    mod.node_group = g
    patch.data.materials.clear()
    return patch


# --- light, sky, camera ------------------------------------------------------


def kelvin_rgb(k):
    """Linear RGB of a blackbody, normalized to its brightest channel (Tanner Helland's fit)."""
    t = k / 100.0
    r = 255.0 if t <= 66 else 329.698727446 * (t - 60) ** -0.1332047592
    g = (
        99.4708025861 * math.log(t) - 161.1195681661
        if t <= 66
        else 288.1221695283 * (t - 60) ** -0.0755148492
    )
    b = (
        255.0
        if t >= 66
        else (0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    )
    srgb = [min(max(c, 0.0), 255.0) / 255.0 for c in (r, g, b)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    m = max(lin)
    return tuple(c / m for c in lin)


def lamp(name, direction, energy, color):
    """A sun lamp shining from *direction* (Blender axes, toward the body)."""
    data = bpy.data.lights.new(name, "SUN")
    data.energy, data.color, data.angle = energy, color, math.radians(0.6)
    ob = bpy.data.objects.new(name, data)
    ob.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(ob)
    return ob


if args.sun_elev is not None:
    e, a_ = math.radians(args.sun_elev), math.radians(args.sun_az or 0.0)
    sun_dir = Vector(
        (math.cos(e) * math.sin(a_), -math.cos(e) * math.cos(a_), math.sin(e))
    )
elif SKY:
    sun_dir = three_to_blender(SKY["sunDir"])
else:
    e, a_ = math.radians(35.0), math.radians(135.0)
    sun_dir = Vector(
        (math.cos(e) * math.sin(a_), -math.cos(e) * math.cos(a_), math.sin(e))
    )
sun_dir.normalize()
el = math.asin(max(-1.0, min(1.0, sun_dir.z)))
# Blender's sky puts its sun at (sin rot cos el, cos rot cos el, sin el); checked by
# rendering the sky's sun disc down the lamp's axis: it lands at the frame's center.
az = math.atan2(sun_dir.x, sun_dir.y)
if sun_dir.z > 0 and args.sun > 0:
    lamp("sun", sun_dir, args.sun, kelvin_rgb(args.sun_kelvin))
if SKY and SKY["light"]["dir"] == SKY["moonDir"]:
    # The game's moonlight: its color, at its share of the game's full sun (2.4).
    c = SKY["light"]["color"].lstrip("#")
    srgb = [int(c[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    moon_rgb = tuple(
        x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in srgb
    )
    lamp(
        "moon",
        three_to_blender(SKY["moonDir"]).normalized(),
        4.0 * SKY["light"]["intensity"] / 2.4 * 0.15,
        moon_rgb,
    )


def star_field(width=8192):
    """The game's star catalog, turned to the exported moment, as an equirectangular
    float image in Blender's world axes. Brightness and size follow the game's star
    shader (Environment.tsx): level 0.45 + 0.13 * (6 - mag), wider for brighter stars."""
    h = width // 2
    img = np.zeros((h, width, 3), np.float32)
    d = arr("star_dir").reshape(-1, 3)
    d = np.stack([d[:, 0], -d[:, 2], d[:, 1]], 1)  # three.js -> Blender axes
    mag, col = arr("star_mag"), arr("star_color").reshape(-1, 3)
    up = d[:, 2] > -0.05
    d, mag, col = d[up], mag[up], col[up]
    # Cycles' equirectangular mapping: u = 0.5 - atan2(y, x) / 2pi, v = 0.5 + asin(z) / pi.
    u = 0.5 - np.arctan2(d[:, 1], d[:, 0]) / (2 * np.pi)
    v = 0.5 + np.arcsin(np.clip(d[:, 2], -1, 1)) / np.pi
    bright = np.clip(6.0 - mag, 0.0, 7.5)
    level = np.clip(0.45 + 0.13 * bright, 0.45, 1.0) * 2.0
    sigma = 0.6 + 0.25 * bright  # pixels
    for x0, y0, lv, sg, c in zip(u * width, v * h, level, sigma, col):
        r = int(math.ceil(3 * sg))
        xs = np.arange(int(x0) - r, int(x0) + r + 1)
        ys = np.arange(int(y0) - r, int(y0) + r + 1)
        ys = ys[(ys >= 0) & (ys < h)]
        g = np.exp(
            -(((xs[None, :] + 0.5 - x0) ** 2) + ((ys[:, None] + 0.5 - y0) ** 2))
            / (2 * sg * sg)
        )
        img[np.ix_(ys, xs % width)] += (lv * g)[..., None] * c
    im = bpy.data.images.new("stars", width, h, alpha=False, float_buffer=True)
    rgba = np.concatenate([img, np.ones((h, width, 1), np.float32)], axis=2)
    im.pixels.foreach_set(rgba.ravel())
    im.pack()
    return im


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
if preset["ambient"] > 0 and args.world == "sky":
    # The night sky's own faint glow, which the physical sky (sun far below) does not give.
    nt = world.node_tree
    out = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputWorld")
    prev = out.inputs["Surface"].links[0].from_socket
    glow = nt.nodes.new("ShaderNodeBackground")
    glow.inputs["Color"].default_value = (0.35, 0.5, 1.0, 1)
    glow.inputs["Strength"].default_value = preset["ambient"]
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(prev, add.inputs[0])
    nt.links.new(glow.outputs["Background"], add.inputs[1])
    nt.links.new(add.outputs["Shader"], out.inputs["Surface"])
if SKY and SKY["sunAltitude"] < -4:
    # Night: the stars, seen by the camera only (they light nothing; the moon lamp does).
    nt = world.node_tree
    out = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputWorld")
    prev = out.inputs["Surface"].links[0].from_socket
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = star_field()
    stars_bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(env.outputs["Color"], stars_bg.inputs["Color"])
    path = nt.nodes.new("ShaderNodeLightPath")
    nt.links.new(path.outputs["Is Camera Ray"], stars_bg.inputs["Strength"])
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(prev, add.inputs[0])
    nt.links.new(stars_bg.outputs["Background"], add.inputs[1])
    nt.links.new(add.outputs["Shader"], out.inputs["Surface"])
scene.world = world

cam_data = bpy.data.cameras.new("camera")
cam_data.sensor_fit = "HORIZONTAL"
cam_data.angle = math.radians(args.fov)
cam_data.clip_start, cam_data.clip_end = 0.1, 2000
cam = bpy.data.objects.new("camera", cam_data)
eye, target = three_to_blender(args.eye), three_to_blender(args.target)
if args.grass > 0:
    grass(Vector((eye.x, eye.y, 0.0)), args.grass)
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
