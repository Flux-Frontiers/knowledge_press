# Sky, seasons and weather

## The clock

The sky follows a clock with five modes. Tap the clock in the top bar to
step through them.

| Mode | The sky |
| --- | --- |
| Live | Your own time. The sun is where it is now for your place, the moon shows its current phase, and the clock names the next sunrise or sunset. |
| Dawn, Day, Dusk, Night | Held at that hour. |

At night the stars come out, the lantern lights the road, and lamps light the
redwood and the exhibits from their feet. The mode is saved between visits.

### Where the sky is placed

The sun, moon and stars are placed for where you are. The browser asks for
your location once; if you allow it, the forest uses it, rounded to 0.1
degree and kept only in this browser. If you refuse, the forest estimates a
place from your time zone. Either way the sky is right for your hemisphere
and season.

The [privacy page](https://flux-frontiers.github.io/knowledge_press/privacy.html)
covers what the forest keeps.

### The stars

The night sky is the real one: the 5,080 stars of magnitude 6 or brighter
from the Yale Bright Star Catalogue, placed for the clock's time and your
place. Size follows brightness and color follows the star's own, and stars
fade toward the horizon. Look up with ++up++ at night to see them.

### Meteors

Meteors cross the night sky at the rates a dark sky would show tonight. A
few an hour are sporadic, from no shower. During a shower the rate climbs,
and its meteors run outward from the shower's radiant, the point among the
stars that the shower is named for. The radiant must be above the horizon
for its shower to show, and the higher it stands the more meteors there
are.

Fast meteors are brief and white with a green cast; slow ones last longer
and burn yellow. Like the stars, meteors are lost in twilight, fog and
cloud.

| Shower | Peak | Rate at peak (per hour) |
| --- | --- | --- |
| Quadrantids | 3 to 4 January | 110 |
| Lyrids | 22 April | 18 |
| Eta Aquariids | 6 May | 50 |
| Southern Delta Aquariids | 30 July | 25 |
| Perseids | 12 to 13 August | 100 |
| Draconids | 8 October | 10 |
| Orionids | 21 October | 20 |
| Leonids | 17 November | 15 |
| Geminids | 14 December | 150 |
| Ursids | 22 December | 10 |

The rates are zenithal hourly rates: a dark sky with the radiant overhead.
A real night shows fewer, and so does the forest. Even at the Perseids'
peak, expect a meteor every minute or two across the whole sky.

To see a shower at its peak, add `?meteors=` to the address with the
shower's name in lowercase, hyphenated (`perseids`, `eta-aquariids`,
`delta-aquariids`). Add `:` and a number to multiply its rate. Set the
clock to Night first. For example:

```
https://flux-frontiers.github.io/knowledge_press/?meteors=geminids:20
```

## Seasons

Pick a season on the start screen or under **Environment** in settings.

| Season | The forest |
| --- | --- |
| Spring | Fresh leaves, the canopy filling in |
| Summer | Full canopy |
| Autumn | Turned leaves, the canopy thinning |
| Winter | No leaves. The wood is the point: every limb and its thickness |

The season is saved between visits.

## Fog and weather

**Fog** in settings sets how thick the standing haze is, from clear to
heavy.

**Random weather**, off by default, adds the day's own weather: morning fog
that builds and burns off, from mist to pea soup, and cloud that grays the
sky and dims the sun and the stars. The weather is rolled every 12 minutes
and is likeliest at dawn. Turn it on under **Environment** in settings;
the setting shows what the weather is now.

To pin the weather for a screenshot, add `?weather=` to the address, with
one of `clear`, `clouds`, `mist`, `fog` or `soup`. For example:

```
https://flux-frontiers.github.io/knowledge_press/?weather=soup
```
