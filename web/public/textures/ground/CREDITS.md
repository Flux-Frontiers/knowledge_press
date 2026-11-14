# Ground texture

`forest_floor.jpg` is Poly Haven's **forrest_ground_01** by Rob Tuytel
(https://polyhaven.com/a/forrest_ground_01), CC0 1.0: a photographed 2 m
square of grass, twigs and leaf litter. The game repeats it at that true size.

Changes: the 1K diffuse, with each channel's mean set to the game's old canvas
ground texture (sRGB 170, 173, 153), because the game multiplies it by the
season's ground color. Made with

    python3 scripts/forest3d/fetch_polyhaven.py --res 1k
    Blender -b --factory-startup -P scripts/forest3d/bake_ground.py -- \
        public/textures/ground/forest_floor.jpg \
        --from ~/Library/Caches/knowledge_press/polyhaven/forrest_ground_01/diff_1k.jpg

`bake_ground.py` without `--from` bakes the Blender scene's procedural floor
instead (a seamless 9 m tile, original to this project).
