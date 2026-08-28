import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, segmentCircleIntersection, WORLD, FIXED_STEP } from '../src/game.js';

const input = { moveX: 0, moveY: 0, aimX: 1200, aimY: 400, shoot: false };

function emptyGame(seed = 1337) {
  const game = createGame(seed);
  game.enemies = [];
  game.spawnTimer = 10000;
  return game;
}

function enemy(kind, x, y, id = 1) {
  const template = createGame().enemies.find(candidate => candidate.kind === kind);
  return { ...template, id, x, y, cooldown: 10000 };
}

function bullet(owner, x, y, vx, vy = 0) {
  return { id: 500, owner, x, y, prevX: x, prevY: y, vx, vy, radius: 4, life: 3 };
}

function run(game, frames, controls = input, settings = {}) {
  const events = [];
  for (let frame = 0; frame < frames; frame++) events.push(...stepGame(game, controls, settings));
  return events;
}

function close(actual, expected, epsilon = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);
}

test('starts with three safely spaced enemies, including both kinds', () => {
  const game = createGame();
  assert.equal(game.enemies.length, 3);
  assert.deepEqual(new Set(game.enemies.map(value => value.kind)), new Set(['hound', 'hunter']));
  assert.ok(game.enemies.every(value => Math.hypot(value.x - game.player.x, value.y - game.player.y) >= 330));
  assert.equal(game.phase, 'playing');
  assert.equal(game.player.hp, 5);
});

test('the same seed and controls produce the same combat state and events', () => {
  const first = createGame(72);
  const second = createGame(72);
  const settings = { spread: true, tripleShot: true, moreEnemies: true };
  for (let frame = 0; frame < 1200; frame++) {
    const controls = { ...input, moveX: Math.sin(frame / 40), moveY: Math.cos(frame / 40), shoot: true };
    assert.deepEqual(stepGame(first, controls, settings), stepGame(second, controls, settings));
  }
  assert.deepEqual(first, second);
  assert.notEqual(first.rngState, first.seed);
});

test('cosmetic settings cannot change combat or its random sequence', () => {
  const bare = createGame(49);
  const juicy = createGame(49);
  const combat = { spread: true, moreEnemies: true };
  const cosmetics = {
    ...combat, screenShake: true, muzzleFlash: true, particles: true,
    hitFlash: true, sound: true, bulletSize: 20, hitStop: true,
    deathSlowMotion: true, squash: true, randomUnknownToggle: true,
  };
  const controls = { ...input, shoot: true, moveY: 0.5 };
  run(bare, 900, controls, combat);
  run(juicy, 900, controls, cosmetics);
  assert.deepEqual(bare, juicy);
});

test('movement normalises diagonals and aiming stays independent of movement', () => {
  const game = emptyGame();
  const before = { x: game.player.x, y: game.player.y };
  stepGame(game, { ...input, moveX: 1, moveY: 1 });
  close(Math.hypot(game.player.x - before.x, game.player.y - before.y), 260 * FIXED_STEP);
  close(game.player.angle, Math.atan2(input.aimY - game.player.y, input.aimX - game.player.x));
  assert.notEqual(game.player.angle, Math.PI / 4);
});

test('movement and physical recoil respect the 25-pixel world margin', () => {
  const game = emptyGame();
  run(game, 1000, { ...input, moveX: -1, moveY: -1, shoot: true }, { playerRecoil: true, rapidFire: true });
  close(game.player.x, 25);
  assert.ok(game.player.y >= 25);
  run(game, 1000, { ...input, moveX: 1, moveY: 1 });
  close(game.player.x, WORLD.width - 25);
  close(game.player.y, WORLD.height - 25);
});

test('held fire obeys a cooldown and rapid fire increases the rate', () => {
  const normal = emptyGame();
  const fast = emptyGame();
  const controls = { ...input, shoot: true };
  stepGame(normal, controls);
  assert.equal(normal.shots, 1);
  run(normal, 10, controls);
  assert.equal(normal.shots, 1);
  run(normal, 109, controls);
  run(fast, 120, controls, { rapidFire: true });
  assert.ok(normal.shots >= 4 && normal.shots <= 5);
  assert.ok(fast.shots >= 10 && fast.shots <= 12);
});

test('fast bullets change speed, while visual bullet settings do not change radius', () => {
  const normal = emptyGame();
  const fast = emptyGame();
  stepGame(normal, { ...input, shoot: true });
  stepGame(fast, { ...input, shoot: true }, { fastBullets: true, bulletSize: 30 });
  close(Math.hypot(normal.bullets[0].vx, normal.bullets[0].vy), 620);
  close(Math.hypot(fast.bullets[0].vx, fast.bullets[0].vy), 1100);
  assert.equal(fast.bullets[0].radius, normal.bullets[0].radius);
});

test('triple shot emits three distinct projectiles and one event per projectile', () => {
  const game = emptyGame();
  const events = stepGame(game, { ...input, shoot: true }, { tripleShot: true });
  assert.equal(game.bullets.length, 3);
  assert.equal(game.shots, 3);
  const angles = events.filter(event => event.type === 'shot').map(event => event.angle);
  assert.deepEqual(angles, [-0.15, 0, 0.15]);
});

test('spread is seeded and only consumes combat randomness when enabled', () => {
  const normal = emptyGame(99);
  const spread = emptyGame(99);
  stepGame(normal, { ...input, shoot: true });
  stepGame(spread, { ...input, shoot: true }, { spread: true });
  assert.equal(normal.rngState, 99);
  assert.notEqual(spread.rngState, 99);
  assert.notEqual(normal.bullets[0].vy, spread.bullets[0].vy);
});

test('hounds chase and fast enemies move farther in the same step', () => {
  const normal = emptyGame();
  normal.enemies = [enemy('hound', 100, 400)];
  const fast = structuredClone(normal);
  stepGame(normal, input);
  stepGame(fast, input, { fastEnemies: true });
  assert.ok(normal.enemies[0].x > 100);
  assert.ok(fast.enemies[0].x > normal.enemies[0].x);
});

test('hunters telegraph before firing a slow, dodgeable projectile', () => {
  const game = emptyGame();
  game.enemies = [{ ...enemy('hunter', 340, 400), cooldown: 0 }];
  const first = stepGame(game, input);
  assert.ok(game.enemies[0].telegraph > 0);
  assert.equal(game.bullets.length, 0);
  assert.equal(first.some(event => event.type === 'shot'), false);
  const events = run(game, 67);
  assert.equal(events.filter(event => event.type === 'shot' && event.owner === 'hunter').length, 1);
  assert.equal(game.player.hp, 5);
  assert.equal(game.bullets[0].owner, 'hunter');
  close(Math.hypot(game.bullets[0].vx, game.bullets[0].vy), 260);
  run(game, 130);
  assert.equal(game.player.hp, 4);
});

test('contact damage grants a short invulnerability window', () => {
  const game = emptyGame();
  game.enemies = [enemy('hound', game.player.x + 30, game.player.y)];
  const first = stepGame(game, input);
  assert.equal(game.player.hp, 4);
  assert.equal(first.filter(event => event.type === 'hit' && event.target === 'player').length, 1);
  run(game, 60);
  assert.equal(game.player.hp, 4);
  run(game, 38);
  assert.equal(game.player.hp, 3);
});

test('hunter bullets are consumed during invulnerability without extra damage', () => {
  const game = emptyGame();
  game.player.invulnerable = 0.5;
  game.bullets = [bullet('hunter', 600, 400, 10000)];
  const events = stepGame(game, input);
  assert.equal(game.player.hp, 5);
  assert.equal(game.bullets.length, 0);
  assert.equal(events[0].type, 'impact');
});

test('lethal damage ends play, and later steps cannot fire, move or take damage', () => {
  const game = emptyGame();
  game.player.hp = 1;
  game.bullets = [bullet('hunter', 600, 400, 10000)];
  const events = stepGame(game, input);
  assert.equal(game.phase, 'over');
  assert.equal(game.player.hp, 0);
  assert.equal(events.filter(event => event.type === 'gameover').length, 1);
  assert.equal(events.find(event => event.type === 'hit').lethal, true);
  const ended = structuredClone(game);
  assert.deepEqual(stepGame(game, { ...input, shoot: true, moveX: 1 }), []);
  assert.deepEqual({ ...game, events: ended.events }, ended);
});

test('a fatal player hit also stops later projectile damage in the same step', () => {
  const game = emptyGame();
  game.player.hp = 1;
  game.enemies = [enemy('hunter', 400, 200)];
  game.bullets = [bullet('hunter', 600, 400, 10000), bullet('player', 100, 200, 100000)];
  const events = stepGame(game, input, { lowHp: true });
  assert.equal(game.phase, 'over');
  assert.equal(game.enemies[0].hp, 3);
  assert.equal(events.filter(event => event.type === 'death').length, 0);
});

test('segment-circle sweep handles tunnelling, tangency, misses and zero-length segments', () => {
  close(segmentCircleIntersection(0, 0, 100, 0, 50, 0, 10), 0.4);
  close(segmentCircleIntersection(0, 10, 100, 10, 50, 0, 10), 0.5);
  assert.equal(segmentCircleIntersection(0, 11, 100, 11, 50, 0, 10), null);
  assert.equal(segmentCircleIntersection(0, 0, 0, 0, 0, 0, 10), 0);
  assert.equal(segmentCircleIntersection(20, 0, 20, 0, 0, 0, 10), null);
  assert.equal(segmentCircleIntersection(20, 0, 40, 0, 0, 0, 10), null);
});

test('a swept bullet hits only the nearest enemy and reports the surface point', () => {
  const game = emptyGame();
  game.enemies = [enemy('hunter', 600, 200, 2), enemy('hunter', 400, 200, 1)];
  game.bullets = [bullet('player', 100, 200, 100000)];
  const events = stepGame(game, input);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.enemies[0].hp, 3);
  assert.equal(game.enemies[1].hp, 2);
  const hits = events.filter(event => event.type === 'hit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 1);
  close(Math.hypot(hits[0].x - game.enemies[1].x, hits[0].y - game.enemies[1].y), game.enemies[1].radius);
});

test('low HP kills existing and new enemies in one hit without changing starting health', () => {
  const game = emptyGame();
  game.enemies = [enemy('hunter', 400, 200)];
  game.bullets = [bullet('player', 100, 200, 100000)];
  const events = stepGame(game, input, { lowHp: true });
  assert.equal(game.enemies.length, 0);
  assert.equal(game.kills, 1);
  assert.equal(events.filter(event => event.type === 'death').length, 1);
  assert.equal(events.find(event => event.type === 'hit').lethal, true);
  assert.equal(events.find(event => event.type === 'death').kind, 'hunter');
  game.spawnTimer = 0;
  stepGame(game, input, { lowHp: true });
  const spawned = game.enemies[0];
  const canonicalHp = spawned.kind === 'hound' ? 2 : 3;
  assert.equal(spawned.hp, canonicalHp);
  assert.equal(spawned.maxHp, canonicalHp);
  game.bullets = [bullet('player', spawned.x - 40, spawned.y, 10000)];
  stepGame(game, input, { lowHp: true });
  assert.equal(game.enemies.length, 0);
  assert.equal(game.kills, 2);
});

test('turning low HP off restores ordinary hit rules for unhit enemies spawned while it was on', () => {
  for (const [seed, kind, canonicalHp] of [[1, 'hound', 2], [3, 'hunter', 3]]) {
    const game = emptyGame(seed);
    game.spawnTimer = 0;
    stepGame(game, input, { lowHp: true });
    const spawned = game.enemies[0];
    assert.equal(spawned.kind, kind);
    stepGame(game, input, { lowHp: false });
    assert.equal(spawned.hp, canonicalHp);
    assert.equal(spawned.maxHp, canonicalHp);
    game.bullets = [bullet('player', spawned.x - 40, spawned.y, 10000)];
    stepGame(game, input, { lowHp: false });
    assert.equal(game.enemies.length, 1);
    assert.equal(spawned.hp, canonicalHp - 1);
    assert.equal(game.kills, 0);
  }
});

test('baseline hounds take two hits and hunters three; each death counts once', () => {
  for (const [kind, hitsRequired] of [['hound', 2], ['hunter', 3]]) {
    const game = emptyGame();
    game.enemies = [enemy(kind, 400, 200)];
    for (let hit = 1; hit < hitsRequired; hit++) {
      game.bullets = [bullet('player', 100, game.enemies[0].y, 100000)];
      const events = stepGame(game, input);
      assert.equal(game.enemies[0].hp, hitsRequired - hit);
      assert.equal(events.some(event => event.type === 'death'), false);
    }
    const y = game.enemies[0].y;
    game.bullets = [bullet('player', 100, y, 100000), bullet('player', 100, y, 100000)];
    const events = stepGame(game, input);
    assert.equal(game.enemies.length, 0);
    assert.equal(game.kills, 1);
    assert.equal(events.filter(event => event.type === 'death').length, 1);
  }
});

test('enemy knockback and player recoil alter only their intended actor positions', () => {
  const normal = emptyGame();
  normal.enemies = [enemy('hunter', 400, 200)];
  normal.bullets = [bullet('player', 100, 200, 100000)];
  const knockback = structuredClone(normal);
  stepGame(normal, input);
  stepGame(knockback, input, { enemyKnockback: true });
  close(knockback.enemies[0].x - normal.enemies[0].x, 26);
  assert.equal(knockback.enemies[0].hp, normal.enemies[0].hp);
  const recoil = emptyGame();
  stepGame(recoil, { ...input, shoot: true }, { playerRecoil: true });
  close(recoil.player.x, WORLD.width / 2 - 7);
});

test('spawns stay safely away from the player and more-enemies increases spawning', () => {
  const normal = emptyGame(22);
  const more = emptyGame(22);
  normal.spawnTimer = 0.01;
  more.spawnTimer = 0.01;
  run(normal, 2);
  run(more, 2, input, { moreEnemies: true });
  assert.equal(normal.enemies.length, 1);
  assert.equal(more.enemies.length, 2);
  assert.ok(more.enemies.every(value => Math.hypot(value.x - more.player.x, value.y - more.player.y) > 320));
  assert.ok(more.spawnTimer < normal.spawnTimer);
});

test('enemy population is capped and overlapping pairs separate', () => {
  const game = emptyGame();
  game.player.invulnerable = 1000;
  for (let index = 0; index < 100; index++) {
    game.spawnTimer = 0;
    stepGame(game, input, { moreEnemies: true });
  }
  assert.equal(game.enemies.length, 40);
  game.enemies = [enemy('hound', 200, 200, 1), enemy('hound', 200, 200, 2)];
  stepGame(game, input);
  assert.ok(Math.hypot(game.enemies[0].x - game.enemies[1].x, game.enemies[0].y - game.enemies[1].y) >= 36);
});

test('world-boundary impacts report the edge and expired bullets are removed', () => {
  const game = emptyGame();
  game.bullets = [bullet('player', 1270, 200, 100000)];
  const events = stepGame(game, input);
  assert.equal(game.bullets.length, 0);
  assert.equal(events[0].type, 'impact');
  close(events[0].x, WORLD.width);
  close(events[0].y, 200);
  game.bullets = [{ ...bullet('player', 100, 100, 1), life: FIXED_STEP / 2 }];
  stepGame(game, input);
  assert.equal(game.bullets.length, 0);
});

test('firing outwards at the player boundary still produces an on-edge impact', () => {
  const game = emptyGame();
  game.player.x = WORLD.width - 25;
  const events = stepGame(game, { ...input, aimX: WORLD.width + 200, shoot: true });
  const impact = events.find(event => event.type === 'impact');
  assert.ok(impact);
  close(impact.x, WORLD.width);
  assert.equal(game.bullets.length, 0);
});

test('each step replaces its events array without mutating earlier events', () => {
  const game = emptyGame();
  const fired = stepGame(game, { ...input, shoot: true });
  const idle = stepGame(game, input);
  assert.notEqual(fired, idle);
  assert.equal(game.events, idle);
  assert.equal(fired.length, 1);
  assert.equal(idle.length, 0);
});
