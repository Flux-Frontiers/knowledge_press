# Forest sounds

All from Freesound (https://freesound.org), each released under CC0 1.0 by its
recordist. Cut from the HQ preview, high-passed to take out wind rumble on the
microphone, loudness-normalized, and encoded as AAC (ffmpeg; loops 80 kbps, calls 96 kbps). The game
crossfades each loop into itself (src/game/ambience.ts), so the cuts need no
seamless ends.

| File | Source | Recordist | Cut |
| --- | --- | --- | --- |
| crickets.m4a | [Crickets At Night - Raw sound](https://freesound.org/s/522299/) | Defelozedd94 | 100-190 s, high-pass 200 Hz |
| frogs.m4a | [WILDTRACK Swamp at night in Minnesota USA](https://freesound.org/s/181364/) | chris_dagorne | 165-245 s, high-pass 120 Hz |
| dawn.m4a | [Bird ambience. Coniferous forest dawn chorus.](https://freesound.org/s/745273/) | SamsterBirdies | 270-360 s, high-pass 150 Hz |
| birds.m4a | [sfx_amb_forest_spring_afternoon-01.wav](https://freesound.org/s/385280/) | bajko | 20-110 s, high-pass 100 Hz |
| wind.m4a | [Forest, Winter, Light Wind](https://freesound.org/s/352436/) | Kinoton | 0-55 s, high-pass 60 Hz |
| owl-1.m4a | [owl_hooting_000102_0145S3 ... 068-074](https://freesound.org/s/558396/) | Gerent | whole, high-pass 120 Hz |
| owl-2.m4a | [owl_hooting_000102_0145S3 ... 037-044](https://freesound.org/s/558397/) | Gerent | whole, high-pass 120 Hz |
| owl-3.m4a | [owl_hooting_000102_0145S3 ... 007-015](https://freesound.org/s/558398/) | Gerent | whole, high-pass 120 Hz |
| owl-4.m4a | [Owl Hoot](https://freesound.org/s/465697/) | Breviceps | whole, high-pass 120 Hz |
| woodpecker-1.m4a | [FX WOODPECKER.wav](https://freesound.org/s/102972/) | DjangoAltona | 0.3-3.5 s, high-pass 250 Hz |
| woodpecker-2.m4a | same | DjangoAltona | 20.3-23.5 s |
| woodpecker-3.m4a | same | DjangoAltona | 56.3-59.5 s |

Loops were normalized to -23 LUFS, calls to -20 LUFS:

    ffmpeg -ss START -t LENGTH -i preview.mp3 \
        -af "highpass=f=HZ,loudnorm=I=-23:TP=-3:LRA=11" \
        -ar 44100 -c:a aac -b:a 80k crickets.m4a
