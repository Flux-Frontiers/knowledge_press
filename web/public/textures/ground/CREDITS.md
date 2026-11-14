# Ground texture

`forest_floor.jpg` is original to this project. It is baked in Blender from the
forest floor shader in `web/scripts/forest3d/ground_shader.py`:

    Blender -b --factory-startup -P scripts/forest3d/bake_ground.py -- public/textures/ground/forest_floor.jpg

It is a seamless 1024 px tile spanning 9 m (the ground repeats it 70 times),
procedural noise only, with no third-party image content.
