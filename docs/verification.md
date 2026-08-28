# Verification

Checked on 28 August 2026 with Node.js 24.19.0 and the local Chromium browser preview.

| Ref | Check | Result |
| --- | --- | --- |
| V1 | `npm test` | 31 tests pass. Covers deterministic combat, cosmetic independence, movement, both enemies, projectile sweeps, damage, game over, combat switches and presets. |
| V2 | JavaScript syntax | `node --check` passes for every source module and the development server. |
| V3 | Local HTTP serving | HTML, JavaScript and CSS return 200. Unknown files, Git metadata, server source and a traversal request return 404. |
| V4 | Bare, Juiced and Overdrive | Browser controls select 0, 16 and 27 effects respectively. Juiced leaves every combat/timing switch off. Demo runs score takedowns and update shot/time counters. |
| V5 | Pause and keyboard focus | P resumes from the Pause button and a focused checkbox; Escape pauses from the canvas. Run statistics stay fixed while paused. |
| V6 | Reduced camera motion | Overdrive leaves all five protected motion switches off and disabled, with the other 22 effects enabled. |
| V7 | Audio integration | Sound initialises after a control gesture; the UI reports it ready, paused and off as appropriate. Audible quality has not been assessed by a human listener. |
| V8 | Visual inspection | Checked the initial screen, Bare gameplay and the Overdrive aftermath. Pausing leaves the arena visible. No browser errors or warnings were captured during these checks. |
| V9 | Manual input and defeat | A canvas click fires a shot. Restart resets time, score and health. Leaving the fox stationary leads to zero health and the defeat screen; the simulation clock then stops. |
| V10 | Preview layout | The default 854 px browser viewport has no horizontal overflow. No other viewport sizes were tested. |

This is an initial prototype check, not a cross-browser or accessibility certification. Safari, Firefox, touch gameplay and controller input have not been tested. The game deliberately uses keyboard and mouse input.
