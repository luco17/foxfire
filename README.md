# Foxfire

A small, almost top-down shooter: play a fox fighting hunters and hounds, then switch the game's feedback on and off. Inspired by Jan Willem Nijman’s [The Art of Screenshake](https://www.youtube.com/watch?v=AJdEqssNZ-U).

## Run

Use Node.js 22 or newer. There are no dependencies to install and no build step.

```sh
npm run dev
```

Open the local address printed in the terminal, normally **http://127.0.0.1:5173**. If that port is occupied, the server tries the next one. Stop it with `Ctrl+C`.

```sh
npm test
```

See [verification notes](docs/verification.md) for the checks run and the remaining testing limits.

The game is designed for a laptop or desktop browser. **No mouse is needed:** press Enter to start, then use WASD or the arrow keys. The controls reflow on a narrow screen, but this prototype has no touch movement controls. Serve the files over HTTP; opening `index.html` directly as a file will not load its JavaScript modules in most browsers.

## Play and compare

| Control | Action |
| --- | --- |
| WASD or arrow keys | Move |
| Enter | Start, resume or try again after defeat |
| P or Escape | Pause / resume |
| R | Restart with the same seed |
| Demo | Start a fresh run with automatic movement and aiming; click again to take control |

Choose a control mode above the arena:

| Mode | Aiming and shooting |
| --- | --- |
| **Move only — default** | The fox aims and fires at the nearest living enemy. You only move. |
| Move + Space | The fox aims automatically. Hold Space to fire; release it to stop. |
| Mouse aim | Aim with the mouse. Hold left click or Space to fire. |

The two automatic aiming modes ignore the trackpad. A small ring marks the current target. Aim assistance never moves the fox; Demo is the separate autopilot for comparing effects. Changing a mode returns keyboard focus to the arena. Juice presets do not change your control mode.

Hunters wear green and fire slow rounds after a visible warning. Hounds chase. You have five health points. Avoid contact and bullets; survive and score takedowns. There is one open arena, one weapon and no campaign, upgrades, multiplayer or save system.

The arena uses a **45° view**, halfway between overhead and ground level. Rounded characters have visible height, with a larger fox, pointed ears and a bushy cream-tipped tail. Character animation adds an idle wag, a stronger running swish and moving feet. The tilt is part of the baseline presentation: movement, targeting and collisions still use the same flat playfield.

**Bare** starts with all 27 optional effects off. **Juiced** enables presentation effects without changing the simulation's combat rules. **Overdrive** also enables the combat and timing experiments. Checkboxes work during play and pause; their time links open the relevant section of the video. Hover an effect label for its explanation.

For a useful comparison, start Demo, try a preset, then restart. Every run starts from seed `1337`; the same inputs and combat options reproduce the same simulation. A camera change can change how a human chooses to aim, but particles and camera randomness never enter the combat simulation.

Sound starts only after a user action. The sound checkbox also mutes immediately. The volume control is deliberately conservative. **Reduce camera motion** overrides the camera and character animation switches, including in presets; it starts checked when your system requests reduced motion. It is not a blanket filter for every particle or flash.

## Small, separate parts

| File | Responsibility |
| --- | --- |
| `src/game.js` | Seeded simulation, movement, enemies, swept bullet collisions, health and score |
| `src/controls.js` | Automatic targeting and the three player control modes; no DOM or combat mutation |
| `src/main.js` | Input, fixed-step scheduling, presets, pause/restart and DOM controls |
| `src/render.js` | Scene composition, camera, particles and aftermath; separate visual randomness |
| `src/actors.js` | Rounded character art, directional poses, tail animation and weapons |
| `src/projection.js` | Shared 45° projection and height-aware mouse aiming |
| `src/audio.js` | Synthesised Web Audio effects; no downloaded sound assets |
| `src/settings.js` | Effect descriptions, groups, presets and video timestamps |
| `scripts/serve.mjs` | Local development server, bound only to this computer |
| `test/` | Simulation, controls, settings, projection and presentation tests using Node’s built-in test runner |

The simulation runs at 120 fixed steps per second; rendering follows the display. A hit pause suspends simulation without blocking the browser. Defeat slowdown stretches the visual aftermath. The baseline game still has health and a defeat state. Larger bullet drawings keep their original hitboxes; death bursts do not deal extra damage. Arrays for enemies, particles, bodies, casings and audio voices are bounded.

See [the design note](docs/design.md) for the video mapping, adaptations and comparison of JavaScript, Phaser, Godot, SpriteKit and Metal. This is a local Git repository; no remote repository or public deployment is created.
