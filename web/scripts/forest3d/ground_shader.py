"""The forest floor recipe, shared by build_blend.py (the scene) and bake_ground.py (the
game's ground tile). Runs inside Blender.

The floor is the season's ground color varied at three scales, all in meters:
20-60 m patches drifting between greener and drier grass, 1-3 m mottling, and
centimeter litter (two browns of dead leaves) that also drives the bump. The caller
supplies the noise, so the scene can sample world position and the bake can sample
a torus, which makes the tile seamless.
"""


def sock(sockets, identifier):
    """A socket by identifier: the Mix node has an A and B per data type, all sharing the names."""
    return next(s for s in sockets if s.identifier == identifier)


def floor(nt, base, noise, patches=True):
    """Build the floor's nodes in node tree *nt*.

    :param nt: The material's node tree.
    :param base: Linear RGB of the ground color.
    :param noise: ``noise(scale_m, detail, roughness) -> Fac socket`` with features about
        *scale_m* meters across.
    :param patches: Include the 20-60 m patches (a tile a few meters wide cannot hold them).
    :return: ``(color socket, bump height socket)``.
    """
    L = nt.links

    def mix(fac, a, b):
        x = nt.nodes.new("ShaderNodeMix")
        x.data_type, x.blend_type = "RGBA", "MIX"
        for sock_id, v in (("Factor_Float", fac), ("A_Color", a), ("B_Color", b)):
            target = sock(x.inputs, sock_id)
            if isinstance(v, tuple):
                target.default_value = v if len(v) == 4 else (*v, 1)
            elif isinstance(v, float):
                target.default_value = v
            else:
                L.new(v, target)
        return sock(x.outputs, "Result_Color")

    def ramp(fac, lo, hi):
        r = nt.nodes.new("ShaderNodeMapRange")
        r.inputs["From Min"].default_value, r.inputs["From Max"].default_value = lo, hi
        L.new(fac, r.inputs["Value"])
        return r.outputs["Result"]

    if patches:
        greener = tuple(c * k for c, k in zip(base, (0.6, 1.1, 0.55)))
        drier = tuple(c * k for c, k in zip(base, (2.1, 1.6, 0.95)))
        ground = mix(ramp(noise(30.0, 2.0, 0.55), 0.3, 0.7), greener, drier)
    else:
        ground = tuple(base)
    # 1-3 m: worn and shaded mottling, darker and browner.
    worn = tuple(c * k for c, k in zip(base, (0.75, 0.6, 0.45)))
    mottled = mix(ramp(noise(1.6, 4.0, 0.55), 0.25, 0.75), ground, worn)
    # Centimeters: dead leaves and twigs, two browns.
    litter = ramp(noise(0.05, 6.0, 0.7), 0.42, 0.62)
    leaves = mix(
        ramp(noise(0.012, 2.0, 0.55), 0.3, 0.7),
        (0.16, 0.09, 0.04),
        (0.07, 0.045, 0.025),
    )
    return mix(litter, mottled, leaves), litter
