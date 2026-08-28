# Foxfire: design and references

## Intent and evidence

Foxfire is a small, almost top-down shooter: one fox, one arena, hunters and hounds. Compare a playable baseline with stronger feedback. No campaign or general-purpose engine is needed.

The reference is Jan Willem Nijman’s [The art of screenshake, INDIGO Classes 2013](https://www.youtube.com/watch?v=AJdEqssNZ-U). The full auto-generated captions were read and selected demonstration frames were inspected; this was not continuous playback. Timestamps locate spoken introductions, not exact effect transitions. No transcript, recording or third-party game assets are included.

## Controls and comparison

[src/settings.js](../src/settings.js) defines the 27 switches, their descriptions and individual video links. Its groups deliberately separate presentation from changes to combat or timing.

| Ref | Group | Implemented controls |
| --- | --- | --- |
| C1 | Feedback | Character animation, Sound effects, Bigger bullets, Muzzle flash, Impact particles, Hit flash, Gun recoil animation, Bassier shots. Animation and audio begin at [8:25](https://www.youtube.com/watch?v=AJdEqssNZ-U&t=505s). |
| C2 | Camera | Camera follow, Look ahead, Screen shake, Directional camera kick. Following begins at [14:42](https://www.youtube.com/watch?v=AJdEqssNZ-U&t=882s); directional kick is separate from random shake at 25:21. |
| C3 | Aftermath | Fallen enemies, Shell casings, Death bursts, Lingering smoke. Retained bodies appear at [13:07](https://www.youtube.com/watch?v=AJdEqssNZ-U&t=787s), casings at 20:31 and smoke at 27:49. |
| C4 | Combat & timing | One-hit enemies, Rapid fire, Faster bullets, Shot spread, Enemy knockback, Player kickback, Hit pause, Triple shot, Faster enemies, More enemies, Slow-motion defeat. Health changes begin at [9:00](https://www.youtube.com/watch?v=AJdEqssNZ-U&t=540s); impact pauses at 18:01. |

**C5 — Presets.** Bare disables every switch. Juiced enables the first three groups; Overdrive also enables Combat & timing. Individual changes produce a custom combination. Bassier shots requires Sound effects. Reduced-motion presets disable character animation and all four camera effects, reflecting the talk’s warning about nausea at 32:19.

## Technology choice

These trade-offs are engineering judgements for this prototype, supported by the linked documentation.

| Ref | Option | Assessment |
| --- | --- | --- |
| T1 | **JavaScript, Canvas and Web Audio — chosen** | Small dependency footprint, quick browser iteration and easy sharing. We own the compact simulation and effects. Native HTML provides the controls; audio starts after interaction. [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API), [Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices). |
| T2 | Phaser | Useful when scenes and engine services grow. Its built-in camera effects save code, but introduce another API for this small experiment. [Phaser](https://docs.phaser.io/phaser/getting-started/what-is-phaser), [cameras](https://docs.phaser.io/phaser/concepts/cameras). |
| T3 | Godot | Strong alternative for a larger game needing a visual editor and native exports. Browser export adds engine machinery and platform limitations; choose GDScript if web matters. [Features](https://godotengine.org/features/), [web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html). |
| T4 | Swift and SpriteKit | Suitable for an Apple-only game. Includes 2D animation, particles and physics, and already renders through Metal. [SpriteKit](https://developer.apple.com/documentation/spritekit). |
| T5 | Direct Metal | Choose for learning GPU programming or a demonstrated rendering requirement. Owning shaders and rendering infrastructure adds work unrelated to this comparison. [Metal](https://developer.apple.com/metal/). |

## Deliberate adaptations

**A1 — Perspective.** The talk uses a platform shooter. Foxfire omits jumping, jump dust and its firing-direction strafing rule; independent movement and aiming suit the arena. Weapon lag is also omitted.

**A2 — Stable rules.** Enlarged bullets change appearance, not collision size. Death bursts cause no damage: the random explosions introduced at 23:41 are not reproduced as chain attacks. Player vulnerability and game over remain in Bare, although the talk adds them near 28:35.

**A3 — Bounded aftermath.** Bodies, casings and particles use caps or lifetimes. Audio voices are capped in [src/audio.js](../src/audio.js). Hit pause suspends simulation without blocking input or rendering; defeat slowdown stretches the final aftermath without lowering the rendering frame rate.

**A4 — Testable boundary.** [src/game.js](../src/game.js) owns seeded combat and fixed simulation steps. Presentation switches must preserve collision, damage and aim rules. Combat switches intentionally do not. Compare those separately when testing or judging whether added feedback improves play.
