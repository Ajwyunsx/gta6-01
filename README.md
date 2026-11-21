[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ajwyunsx/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ajwyunsx/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Palm City

An original open-world crime game that runs in the browser — a [make.fun](https://make.fun) bounty entry. Top-down 2D canvas, static files, no network calls, no build step. City, characters, script, art direction and the WebAudio soundtrack are all ours; nothing is lifted from a commercial game.

You roll into Palm City with a borrowed jacket and a beater car. A fixer named Marisol has seven jobs for you — courier runs, a collection, a chase, a marina heist — and the whole time the city is clocking your face. Every cruiser you dust off remembers you, and the wanted stars only cool if you actually get out of sight.

![Cover: on the coastal avenue, courier ahead](screenshots/1-cover.jpg)

## Features

- A hand-built neon-dusk city: road grid, beachfront avenue, rooftop blocks, palms, lit windows, parking lots, a marina.
- On foot and behind the wheel: arcade handling with handbrake, engine pitch and horn; parked and traffic cars are hot-wirable — walk up, press E.
- Living streets: pedestrians on the sidewalks, ambient traffic that keeps lanes and stops spawning on your bumper.
- A wanted system with teeth: patrol cruisers respond to heat, chase, pit and box you in; break line of sight and it decays.
- Combat: hitscan shooting with tracers and muzzle flash, health / armour / cash pickups.
- Seven missions with briefings, objective markers and paydays, plus a completion screen.
- HUD with live minimap, money, health, armour, wanted stars; title, pause, busted, mission and save/load screens (localStorage).
- Fully synthesized audio — engine, gunshots, sirens, pickups, a synthwave loop — generated in WebAudio, zero audio assets.

![On foot outside the Coral Room](screenshots/2-onfoot.jpg)
![Four stars and a wall of cruisers](screenshots/3-police.jpg)
![The Pay-In briefing](screenshots/4-mission.jpg)

## Run

```
node serve.ts        # then open http://localhost:8080
```

Any static file server works; the game is just `game/index.html` plus `game/src/*.js`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (walk, or drive) |
| Mouse | Aim |
| Left click | Shoot |
| Shift | Sprint (on foot) |
| E | Enter / exit vehicle, interact |
| Space | Handbrake (in car) |
| H | Horn |
| M | Mute audio |
| Esc | Pause |
| Enter | Confirm |
| R | Restart after a bust |

## License

MIT
