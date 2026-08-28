# Verification

Checked on 28 August 2026 with Node.js 24.19.0 and the local Chromium browser preview.

| Ref | Check | Result |
| --- | --- | --- |
| V1 | `npm test` | 58 tests pass. Covers deterministic combat, cosmetic independence, movement, both enemies, projectile sweeps, damage, game over, combat switches, presets and the three control modes. Projection and presentation tests cover height-aware aiming, camera offsets, frozen animation, idle tail motion, gait and drawing without mutating actors. |
| V2 | JavaScript syntax | `node --check` passes for every source module and the development server. |
| V3 | Local HTTP serving | HTML, JavaScript and CSS return 200. Unknown files, Git metadata, server source and a traversal request return 404. |
| V4 | Bare, Juiced and Overdrive | Browser controls select 0, 16 and 27 effects respectively. Juiced leaves every combat/timing switch off. Demo runs score takedowns and update shot/time counters. |
| V5 | Pause and keyboard focus | P resumes from the Pause button and a focused checkbox; Escape pauses from the canvas. Run statistics stay fixed while paused. |
| V6 | Reduced camera motion | Overdrive leaves all five protected motion switches off and disabled, with the other 22 effects enabled. |
| V7 | Audio integration | Sound initialises after a control gesture; the UI reports it ready, paused and off as appropriate. Audible quality has not been assessed by a human listener. |
| V8 | Visual inspection | Checked the initial screen, Bare gameplay and the Overdrive aftermath. Pausing leaves the arena visible. No browser errors or warnings were captured during these checks. |
| V9 | Manual input and defeat | A canvas click fires a shot in Mouse aim mode. Restart resets time, score and health. Leaving the fox stationary without firing in Move + Space leads to zero health and the defeat screen; Enter starts a fresh run. |
| V10 | Preview layout | The initial 854 px viewport and the 999 px viewport used for the laptop-controls check have no horizontal overflow. No mobile viewport was tested. |
| V11 | Laptop controls | With Demo off, Move only fires and scores without movement or firing input. Move + Space stays at zero shots until Space is pressed; a tap fires once and the counter stays at one after release. Selecting a control mode returns focus to the canvas. Enter starts or resumes from the arena. P pauses. A Juiced preset change preserves the selected control mode. |
| V12 | Stronger muzzle flash | Visually checked a single shot with the larger flame, bright core and local glow, then the same firing input with the effect off. The flash lasts 130 ms and remains separate from combat rules. No browser errors or warnings were captured. |
| V13 | Gun size and recoil | Visually checked the enlarged gun at rest, after a shot, with muzzle flash, and with recoil disabled. The tilted art retains a large weapon and the 17-unit recoil. Its resting muzzle position and physical player kickback are unchanged. |
| V14 | Tilted character art | Inspected all eight fox headings in a temporary contact sheet, including 0.44× laptop scale. Compared two animated tail poses and the full recoil pose. Rounded characters, raised heads, cream tail tips and grounded shadows remain distinct. The temporary sheet is not shipped with the game. |
| V15 | Tilted gameplay | A presentation-only Demo run scored four takedowns with 17 shots. Fresh Space and mouse runs each fired one shot, then paused. Overdrive with reduced motion left all five protected switches off and disabled (22/27 effects). The game and art preview reported no browser errors or warnings. |

This is an initial prototype check, not a cross-browser or accessibility certification. Safari, Firefox, touch gameplay and controller input have not been tested. Keyboard input is sufficient for the default mode; mouse aiming is optional.
