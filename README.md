# Foxfire

A small, almost top-down shooter: play a fox fighting hunters and hounds, then switch the game's feedback on and off. Inspired by Jan Willem Nijman’s [The Art of Screenshake](https://www.youtube.com/watch?v=AJdEqssNZ-U).

Play [Foxfire](https://foxfire.pages.dev/).

## Run

Use Node.js 22 or newer. There are no dependencies to install. Development runs directly from the source files; the build step below prepares files for publishing.

```sh
npm run dev
```

Open the local address printed in the terminal, normally **http://127.0.0.1:5173**. If that port is occupied, the server tries the next one. Stop it with `Ctrl+C`.

```sh
npm test
```

See [verification notes](docs/verification.md) for the checks run and the remaining testing limits.

The game is designed for a laptop or desktop browser with a keyboard and mouse. Press Enter to start. The interface reflows on a narrow screen, but this prototype has no touch movement controls. Serve the files over HTTP; opening `index.html` directly as a file will not load its JavaScript modules in most browsers.

## Publish with Cloudflare Pages

```sh
npm run build
```

This replaces `dist/` with `index.html`, the browser JavaScript and CSS from `src/`, and image files from `assets/`, including the 1200 × 630 social preview card. Tests, documentation, package metadata, other asset files and the development server are not copied. The build does not bundle or transform the game.

Connect the GitHub repository through [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) and use these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root; leave blank |

Once connected, pushes to `main` trigger production builds and deployments. **Node.js is only development, test and build tooling.** The game runs entirely in the browser; Pages serves static files and needs no Node.js game server.

## Play and compare

| Control | Action |
| --- | --- |
| WASD | Move |
| Mouse | Aim |
| Hold left mouse button | Fire; release to stop |
| Enter | Start, resume or try again after defeat |
| P or Escape | Pause / resume |
| R | Restart with the same seed |
| Options / J | Open the effects panel |
| Escape with options open | Close the panel |
| Demo | Start a fresh run with automatic movement, aiming and firing; click again to take control |

The arena fills the window, with a small toolbar and a compact score display. **Options** opens a floating panel; the arena keeps its size behind it. Opening the panel pauses a player run and closing it resumes that same run. A run you paused yourself stays paused. **Demo keeps running** while the panel is open so you can compare effects live.

There is one player control scheme. Movement and aiming are independent, so you can retreat while firing. Demo is a separate autopilot for comparing effects. Focus stays inside Options while you adjust effects, then returns to the arena when you close it. Juice presets do not change the controls.

Hunters wear red hunting coats and top hats, and fire slow rounds after a visible warning. Hounds chase. You have five health points. Avoid contact and bullets; survive and score takedowns. There is one open arena, one weapon and no campaign, upgrades, multiplayer or save system.

The arena uses a **45° view**, halfway between overhead and ground level. Rounded characters have visible height, with a larger fox, pointed ears and a bushy cream-tipped tail. Character animation adds an idle wag, a stronger running swish and moving feet. The tilt is part of the baseline presentation: movement, aiming and collisions still use the same flat playfield.

**Bare** starts with all 27 optional effects off. **Juiced** enables presentation effects without changing the simulation's combat rules. **Overdrive** also enables the combat and timing experiments. Checkboxes work during play and pause; their time links open the relevant section of the video. Hover an effect label for its explanation.

For a useful comparison, start Demo, try a preset, then restart. Every run starts from seed `1337`; the same inputs and combat options reproduce the same simulation. A camera change can change how a human chooses to aim, but particles and camera randomness never enter the combat simulation.

Sound starts only after a user action. The sound checkbox also mutes immediately. The volume control is deliberately conservative. **Reduce camera motion** overrides the camera and character animation switches, including in presets; it starts checked when your system requests reduced motion. It is not a blanket filter for every particle or flash.

## Small, separate parts

| File | Responsibility |
| --- | --- |
| `src/game.js` | Seeded simulation, movement, enemies, swept bullet collisions, health and score |
| `src/controls.js` | Player aim/fire input and Demo targeting; no DOM or combat mutation |
| `src/main.js` | Input, fixed-step scheduling, presets, pause/restart and DOM controls |
| `src/render.js` | Scene composition, camera, particles and aftermath; separate visual randomness |
| `src/actors.js` | Living and fallen character art, directional poses, tail animation and weapons |
| `src/projection.js` | Shared 45° projection and height-aware mouse aiming |
| `src/audio.js` | Synthesised Web Audio effects; no downloaded sound assets |
| `src/settings.js` | Effect descriptions, groups, presets and video timestamps |
| `scripts/serve.mjs` | Local development server, bound only to this computer |
| `scripts/build.mjs` | Copies only the static game files into `dist/` for publishing |
| `test/` | Simulation, controls, settings, projection and presentation tests using Node’s built-in test runner |

The simulation runs at 120 fixed steps per second; rendering follows the display. A hit pause suspends simulation without blocking the browser. Defeat slowdown stretches the visual aftermath. The baseline game still has health and a defeat state. Larger bullet drawings keep their original hitboxes; death bursts do not deal extra damage. Arrays for enemies, particles, bodies, casings and audio voices are bounded.

See [the design note](docs/design.md) for the video mapping, adaptations and comparison of JavaScript, Phaser, Godot, SpriteKit and Metal.
