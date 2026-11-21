[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ajwyunsx/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ajwyunsx/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Palm City

An original open-world crime game for the desktop browser — a [make.fun](https://make.fun) bounty entry. Top-down 2D canvas, static files, no network, no build step. Everything is our own: city, characters, names, story, art direction and the WebAudio synth soundtrack. Nothing is taken from any commercial game.

You arrive in Palm City with a borrowed jacket and a beater car. A fixer named Marisol has seven jobs for you — courier runs, collections, a chase, a heist — and the city's wanted system remembers everything you do.

## Features

- A procedural neon-dusk city: road grid, beach avenue, rooftop blocks, palms, lit windows, parking lots.
- On foot and behind the wheel: arcade driving with handbrake, horn and engine pitch, parked and traffic cars you can hot-wire (walk up, press E).
- Living streets: pedestrians on the sidewalks, ambient traffic with lane logic.
- A wanted level with real consequences: patrol cruisers respond, chase, and try to box you in; lie low and the heat cools.
- Combat: hitscan shooting with tracers, muzzle flash, health/armor/pickups.
- A story chain of seven missions with briefings, markers and paydays, plus a platinum-style completion screen.
- HUD with a live minimap, money, health, armor and wanted stars; title, pause, save/load (localStorage), busted and mission screens.
- Synthesized audio: engine hum, gunshots, sirens, pickups and a synthwave loop — all generated in WebAudio, zero audio files.

## Run

```
node serve.ts        # then open http://localhost:8080
```

Controls: WASD move, mouse aim, click shoot, E enter/exit car, Shift sprint, Space handbrake (in car), Esc pause, M mute.

## License

MIT
