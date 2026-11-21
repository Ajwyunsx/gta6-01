# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ajwyunsx/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ajwyunsx/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palm City** — an original top-down open-world crime game that runs in a desktop browser from
static files, offline, with no library and no build step. A fictional Florida-strip city of coral
stucco and teal neon, built on a seeded grid: seven blocks square, an ocean boardwalk down the east
side, a marina and a bridge.

Everything in it is its own: the city, the streets, the people, the cars, the seven-job story, the
art, the synthesised sound. Nothing is taken from any commercial game.

## What's in the box

- **A city to explore.** A seeded 7×7 grid of blocks — towers, midrises, row shops, parks, parking
  lots, two beach clubs — extruded into a fake-3D skyline against a low sun, with palms, street
  furniture, lit windows and painted shop signs.
- **On foot and by car.** Walk the strip, then take any parked car: arcade steering, drift, engine
  note that follows the revs.
- **Traffic and pedestrians.** Ambient cars run their lanes and stop for each other; pedestrians
  wander the pavements, buskers play, couples argue, dog-walkers cross.
- **A wanted level and police who answer it.** One to five stars. Cruisers spawn off-screen, chase,
  ram, and officers get out on foot. Lose them, or get busted.
- **Seven jobs and a story.** A chain of briefings with markers on the map and on the minimap:
  deliveries, a shakedown, a tail, a defend-the-club holdout, a getaway.
- **Combat.** Hitscan pistol and shotgun, health and armour, pickups, muzzle flash, tracers,
  blood-free hit sparks, screen shake.
- **A HUD that carries it.** Health and armour bars, ammo, cash, wanted stars, the current job, and
  a live circular minimap that draws the actual block grid as you move.
- **Menus and a save.** Title screen, pause, save and load to `localStorage`, a busted screen.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Any static file server works — `game/index.html` is the whole game. Hand-in:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
