# Settings

++esc++, or **Controls and settings** in the three-dot menu at the top right,
opens the settings. The cart is parked while they are open. Every setting is saved in this browser.

## Driving and view

| Setting | What it does |
| --- | --- |
| Driving pace | **Gentle exploration** or **Brisk driving**: how fast the cart goes. |
| Look sensitivity | How far a push on the arrows or the stick turns the view. |
| Wind and gentle cart motion | The leaves move in the wind and the cart sways. Off by default when your system asks for reduced motion. |

## Detail and performance

| Setting | What it does |
| --- | --- |
| Leaf complexity | How many of each book's passages are drawn as leaves: **Low** one in ten, **Medium** one in four, **High** one in two, **Ultra** every one. Every level keeps the trees in proportion. Touch devices start at High. Changing it regrows the forest. |
| Shadows | The sun's and moon's shadows. Off by default; on an iPad mini, turning them off about doubled the frame rate. |
| Undergrowth | Grass and stones on the forest floor. On by default. |
| Show geometry and frame rate | A readout of triangles, draw calls, leaves and frames per second. |

## Sound and cards

| Setting | What it does |
| --- | --- |
| Read each grove aloud on the ring | On the guided tour, the captions are read in the system voice. Off by default. |
| Read moots aloud | A playing [moot](moots.md) is read aloud, each book in a voice matching its author. On by default; the speaker button in the moot player flips it too. |
| First tree's voice, second tree's voice | Shown while **Read moots aloud** is on. **Automatic** picks a voice for each author; or pick one of this browser's English voices. A choice this browser lacks is marked *(not here)*. |
| Silent mode | No cards, hints or captions appear on their own. ++e++, ++r++ and clicking a tree still work. |

## Live moots

| Setting | What it does |
| --- | --- |
| GutenbergKG worker | Where the worker that holds a [new moot](moots.md#hold-a-new-moot) listens, for example `http://localhost:8000`. Empty by default. |
| Moot token | Only if the worker sets `MOOT_TOKEN`. Kept in this browser. |

In the app, the worker is the one in the app's Settings, under **Worker**, so
this section shows only the token, and only when a worker is set.

## Environment

| Setting | What it does |
| --- | --- |
| Season | Spring, summer, autumn or winter. Each visit starts in the season of the date; a choice here lasts until you reload. |
| Fog | Clear, light, normal or heavy standing haze. |
| Random weather | Morning fog that burns off, and cloud. Off by default. See [Fog and weather](sky.md#fog-and-weather). |

## Reset all settings

**Reset all settings**, at the bottom, asks first, then:

- Puts every setting above back to its default.
- Sets the season to the date's and the clock to live.
- Forgets the tour's welcome, so the next tour gives it in full again.

The press and the groves you have visited are kept. To empty the press, use
**Empty the press** in the Press tab; see [The press](reading.md#the-press).
