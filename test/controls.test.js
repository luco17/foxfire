import test from 'node:test';
import assert from 'node:assert/strict';
import { getAutoAim, getPlayerInput } from '../src/controls.js';
import { createGame, stepGame } from '../src/game.js';

function enemy(id, x, y, fields = {}) {
  return { id, x, y, hp: 2, vx: 0, vy: 0, ...fields };
}

function gameWith(enemies) {
  const game = createGame();
  game.player.x = 100;
  game.player.y = 100;
  game.enemies = enemies;
  return game;
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);
}

test('default controls aim and fire with no mouse, keys or movement', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  assert.deepEqual(getPlayerInput(game), {
    moveX: 0, moveY: 0, aimX: 300, aimY: 100,
    shoot: true, targetId: 1, manualAim: false,
  });
});

test('automatic controls ignore pointer and fire input', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  const expected = getPlayerInput(game);
  assert.deepEqual(getPlayerInput(game, { mode: 'auto', fire: false, pointerAim: { x: 0, y: 800 } }), expected);
  assert.deepEqual(getPlayerInput(game, { mode: 'auto', fire: true, pointerAim: { x: 1000, y: 0 } }), expected);
});

test('every mode leaves movement entirely to the player and passes axes to the core', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  for (const mode of ['auto', 'space', 'mouse']) {
    const input = getPlayerInput(game, { mode, moveX: -1, moveY: 0.5 });
    assert.equal(input.moveX, -1);
    assert.equal(input.moveY, 0.5);
    assert.equal(getPlayerInput(game, { mode }).moveX, 0);
    assert.equal(getPlayerInput(game, { mode }).moveY, 0);
  }
});

test('auto aim selects the nearest living enemy and retargets after a death', () => {
  const game = gameWith([enemy(1, 300, 100), enemy(2, 120, 100, { hp: 0 }), enemy(3, 200, 100)]);
  assert.equal(getAutoAim(game).targetId, 3);
  game.enemies[2].hp = 0;
  assert.equal(getAutoAim(game).targetId, 1);
  game.enemies[0].hp = 0;
  assert.equal(getAutoAim(game), null);
});

test('equal-distance targets use the same ID even when their array order changes', () => {
  const game = gameWith([enemy(9, 200, 100), enemy(2, 100, 200)]);
  assert.equal(getAutoAim(game).targetId, 2);
  game.enemies.reverse();
  assert.equal(getAutoAim(game).targetId, 2);
});

test('target leading uses enemy velocity and the selected bullet speed', () => {
  const game = gameWith([enemy(1, 720, 100, { vx: 10, vy: 20 })]);
  assert.deepEqual(getAutoAim(game), { aimX: 727, aimY: 114, targetId: 1 });
  const faster = getAutoAim(game, { fastBullets: true });
  const lead = 620 / 1100 * 0.7;
  close(faster.aimX, 720 + 10 * lead);
  close(faster.aimY, 100 + 20 * lead);
});

test('Space mode aims automatically but fires only while Space is held', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  const controls = { mode: 'space', pointerAim: { x: 0, y: 0 } };
  const held = getPlayerInput(game, { ...controls, fire: true });
  assert.equal(held.shoot, true);
  assert.equal(held.aimX, 300);
  assert.equal(held.targetId, 1);
  assert.equal(held.manualAim, false);
  assert.equal(getPlayerInput(game, { ...controls, fire: false }).shoot, false);
  assert.equal(getPlayerInput(game, controls).shoot, false);
});

test('Space can fire into an empty arena using the current facing direction', () => {
  const game = gameWith([]);
  game.player.angle = Math.PI / 2;
  const input = getPlayerInput(game, { mode: 'space', fire: true });
  assert.equal(input.shoot, true);
  assert.equal(input.targetId, null);
  assert.equal(input.manualAim, false);
  close(input.aimX, 100);
  close(input.aimY, 260);
});

test('mouse mode uses explicit aim and firing without selecting a target', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  const controls = { mode: 'mouse', pointerAim: { x: 450, y: 220 }, fire: true };
  const input = getPlayerInput(game, controls);
  assert.equal(input.aimX, 450);
  assert.equal(input.aimY, 220);
  assert.equal(input.shoot, true);
  assert.equal(input.targetId, null);
  assert.equal(input.manualAim, true);
  assert.equal(getPlayerInput(game, { ...controls, fire: false }).shoot, false);
});

test('mouse aim without a pointer falls back to the current facing direction', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  game.player.angle = Math.PI;
  const input = getPlayerInput(game, { mode: 'mouse', pointerAim: null });
  close(input.aimX, -60);
  close(input.aimY, 100);
  assert.equal(input.manualAim, true);
  assert.equal(input.shoot, false);
});

test('automatic mode idles without living targets and recalculates its fallback position', () => {
  const game = gameWith([]);
  assert.equal(getAutoAim(game), null);
  const idle = getPlayerInput(game, { fire: true });
  assert.equal(idle.shoot, false);
  assert.equal(idle.targetId, null);
  assert.equal(idle.aimX, 260);
  game.player.x = 250;
  game.player.y = 200;
  game.player.angle = Math.PI / 2;
  const moved = getPlayerInput(game);
  close(moved.aimX, 250);
  close(moved.aimY, 360);
});

test('no control mode fires after the game ends', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  game.phase = 'over';
  for (const mode of ['auto', 'space', 'mouse']) {
    assert.equal(getPlayerInput(game, { mode, fire: true }).shoot, false);
  }
});

test('controls are deterministic, do not mutate their arguments and ignore cosmetic flags', () => {
  const game = gameWith([enemy(1, 300, 100, { vx: -40, vy: 15 })]);
  const controls = { mode: 'auto', moveX: 1, pointerAim: { x: 50, y: 60 } };
  const settings = { fastBullets: true };
  const before = structuredClone({ game, controls, settings });
  const first = getPlayerInput(game, controls, settings);
  assert.deepEqual(getPlayerInput(game, controls, settings), first);
  assert.deepEqual(getPlayerInput(game, controls, {
    ...settings, animation: true, shake: true, sound: true,
    cameraEase: true, cameraLead: true, muzzleFlash: true, bigBullets: true,
  }), first);
  assert.deepEqual({ game, controls, settings }, before);
});

test('a short default game scores takedowns without any mouse or keyboard input', () => {
  const game = createGame();
  const start = { x: game.player.x, y: game.player.y };
  for (let frame = 0; frame < 720 && game.phase === 'playing'; frame++) {
    stepGame(game, getPlayerInput(game));
  }
  assert.ok(game.shots > 0);
  assert.ok(game.kills > 0);
  assert.equal(game.player.x, start.x);
  assert.equal(game.player.y, start.y);
});
