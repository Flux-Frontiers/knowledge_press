# forest3d: the forest in Blender, Cycles and quiltwright

These scripts rebuild the web forest as a Blender scene. The scene can be
path-traced with Cycles as stills, or rendered as a Looking Glass quilt
through [quiltwright](https://github.com/Flux-Frontiers/quiltwright).
Nothing here ships in the app.

The geometry comes from the game's own modules. `export.mjs` compiles
`src/game/*.ts` the same way `scripts/test.mjs` does and calls `getForest()`.
The trees, leaves, redwood and roads are therefore exactly the game's.

## Pipeline

Run from `web/`. `OUT` is any scratch folder outside the repo.

```bash
OUT=/tmp/forest3d
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender

# 0. Once: fetch the Essentials materials and HDRI worlds (about 113 MB, 30 s).
python3 scripts/forest3d/fetch_essentials.py

# 1. Export raw arrays and manifest.json (about 5 s for the whole forest).
node scripts/forest3d/export.mjs $OUT/forest                        # every grove
node scripts/forest3d/export.mjs $OUT/birch --region 23 78 15       # one grove, as a diorama

# 2. Build each .blend headless (Blender 5.2, about 2 s).
$BLENDER -b --factory-startup -P scripts/forest3d/build_blend.py -- \
    $OUT/forest $OUT/forest.blend --eye 120 110 330 --target 0 0 0 --fov 55
$BLENDER -b --factory-startup -P scripts/forest3d/build_blend.py -- \
    $OUT/birch $OUT/birch.blend --eye 23 44 150.5 --target 23 11 78 --fov 45

# 3a. A still (about 10 s on an M-series GPU).
$BLENDER -b --factory-startup $OUT/forest.blend -o $OUT/still_ -F PNG -f 1

# 3b. A 16-landscape quilt with quiltwright's venv, using the .blend's camera, sun and sky
#     (48 views, about 75 s). Writes $OUT/quilts/birch_qs8x6a1.77778.png and the views.
~/repos/quiltwright/.venv/bin/python scripts/forest3d/quilt.py $OUT/birch.blend $OUT/quilts/birch
```

`--eye` and `--target` are game coordinates: three.js, Y-up, meters. The
hub is at the origin.

## What is in the scene

| Game piece | Source | In Blender |
|---|---|---|
| Book trees (bark) | `forest.chunks[].bark` | One mesh per grove. The game's normals, its photo bark (`public/textures/bark`), tinted by the season's wood color |
| Leaves | `forest.leaves` | One point per leaf, instanced by geometry nodes with the game's quaternion, scale and season color. The season's density is applied; wind is not |
| Corpus redwood | `forest.corpusTree` | Bark mesh with a procedural furrowed-bark shader, plus spray cards instanced like the leaves |
| Roads, plazas | `roads.ts` `ribbon` / `fillets` / `disc` | The game's meshes and UVs, herringbone brick |
| Grove grounds | `forest.groves` | Tinted discs with the game's radial fade, casting no shadow |
| Ground | season palette | Day color times the game's ground texture, with procedural speckle |

Not yet included: grass and rocks, exhibits, signposts, compass rose,
lantern trail, cart, sundial, sky objects and fog.

The grass and rock placement lives inside `Environment.tsx`
(`ForestFloor`, seeded `mulberry32(247)`). To export it without copying the
logic, it would have to move into a `.ts` module.

## Time of day and stars

`export.mjs --time noon|sunrise|sunset|night` (or an ISO time) puts the
game's own sky (`sky.ts`) at that moment, at latitude 40, longitude -75
unless you pass `--place`. Without `--date`, each season uses its own
solstice or equinox (summer: June 21), so the light matches the leaves.

- `sunrise` and `sunset` are when the sun crosses `--sun-alt`, 10 degrees
  by default. The game's own dawn and dusk use 4 degrees, where its light
  is nearly pure orange.
- `night` is the game's choice: the darkest hour, or when the moon is
  highest.

The manifest records the resolved moment and time zone.

`build_blend.py` lights each preset with its own sun irradiance, color
temperature, sky strength and exposure. Measured on the overview, over the
lower half of the frame:

| `--time` | Mean (of 255) | Red/blue | Note |
|---|---|---|---|
| `noon` | 91, 124, 81 | 1.11 | sun 4 W/m², 5800 K |
| `sunrise` | 81, 98, 67 | 1.20 | sun 6, 3600 K, exposure +1 |
| `sunset` | 84, 95, 66 | 1.27 | sun 6, 3200 K, exposure +1 |
| `night` | 12, 26, 19 | 0.62 | the game's moonlight, faint blue glow, exposure +3 |

`--sun`, `--sun-kelvin`, `--sky` and `--exposure` override a preset.

At night, the game's Yale Bright Star catalog, turned to the exported
moment, is rasterized into an 8192 px equirectangular map that only camera
rays see. Brightness and size follow the game's star shader. To check
orientation, Polaris, Vega and Altair each render at the center of a
camera aimed at them, and denoising leaves the stars intact. Stars are for
stills: content at infinity shifts far too much between quilt views.

## The ground

`ground_shader.py` holds the forest floor. It varies at three scales in
world meters: 30 m patches of greener and drier grass, 1.6 m mottling, and
5 cm leaf litter that also drives the bump. Both the world ground and the
grove tints use it. `--grass R` scatters patchy grass tufts within R meters
of the point below the camera, in the game's seasonal grass color, and
keeps them off the roads.

`bake_ground.py` bakes the same floor, without the 30 m patches, into the
game's ground texture. The result is a seamless 9 m tile, 1024 px,
`public/textures/ground/forest_floor.jpg`. It samples 4-D noise on a
torus, and its mean color is set to the old canvas speckle's.

```bash
$BLENDER -b --factory-startup -P scripts/forest3d/bake_ground.py -- public/textures/ground/forest_floor.jpg
```

## Light and exposure

The view transform is `Standard`, quiltwright's default, at exposure 0.

By default the sun lamp (4 W/m²) is the key light, and Blender's physical
sky (strength 0.08) is the fill, with its own sun disc off so there is one
sun. Measured on the overview: the sunlit ground is about 90 to 110 of 255,
the visible sky about 75, and no pixels clip.

`--world` lights the scene with an HDRI from Blender's online Essentials
library instead. Pass `--sun 0` with it, since the HDRI carries its own sun.
The camera still sees the physical sky. The HDRIs are photographs of a city
square, a real forest and so on, which would otherwise stand behind the
forest. `--world-angle` turns the HDRI.

| `--world` | Overview ground (of 255) | Note |
|---|---|---|
| `sky` (default) | 90-111 | sun lamp plus sky, hard shadows |
| `Sunrise` | 125-131, 0.8% clipped | warm, low, long shadows |
| `Sunset` | 79-97 | soft, cool |
| `Forest Street` | 57-67 at `--exposure 1.5` | dim, green; needs the exposure |
| `Night` | not measured | |

## Blender's online Essentials library

`fetch_essentials.py` downloads part of the Essentials library's online half
(`cdn.extensions.blender.org/asset-libraries/essentials`, CC0). Each file is
checked against the library listing's SHA256. Files go to
`~/Library/Caches/knowledge_press/blender-essentials`, about 113 MB:

- the brick, metal and wood materials (procedural, in meters)
- the Forest Street, Sunrise, Sunset and Night HDRI worlds

`build_blend.py --road "Bricks - Natural"` lays an Essentials brick on the
roads in place of the game's photo herringbone. `--road` also accepts
`"Bricks - Regular"` and `"Bricks - Cobblestone"`.
`fetch_essentials.py --list` shows every material and world. The library
has no bark, ground or foliage, so those keep the game's own textures.

## Holograms

The whole forest is far too deep for one quilt; disparity on the Looking
Glass runs well past 8 px. Export one grove with `--region`, which puts it
on its own round plinth. The birch framing above has the focal plane at
79.7 m. The nearest crown is at 64.8 m and the far rim at 97.9 m, which
gives 4.8 px and 3.9 px of adjacent-view disparity with the cone at 35
degrees (`quiltwright.view_disparity`). That is inside the 5 px budget.
Measure a new framing the same way before a full render.
