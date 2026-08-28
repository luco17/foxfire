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

test('default controls keep the current facing and never move, target or fire automatically', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  assert.deepEqual(getPlayerInput(game), {
    moveX: 0, moveY: 0, aimX: 260, aimY: 100,
    shoot: false, targetId: null, manualAim: true,
  });
});

test('pointer coordinates control aim exactly, including zero coordinates', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  for (const pointerAim of [{ x: 450, y: 220 }, { x: 0, y: 0 }]) {
    const input = getPlayerInput(game, { pointerAim });
    assert.equal(input.aimX, pointerAim.x);
    assert.equal(input.aimY, pointerAim.y);
    assert.equal(input.targetId, null);
    assert.equal(input.manualAim, true);
    assert.equal(input.shoot, false);
  }
});

test('movement axes pass through independently of mouse aiming and firing', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  const controls = { moveX: -1, moveY: 0.5, fire: true, pointerAim: { x: 450, y: 220 } };
  const input = getPlayerInput(game, controls);
  assert.equal(input.moveX, -1);
  assert.equal(input.moveY, 0.5);
  assert.equal(input.aimX, 450);
  assert.equal(input.aimY, 220);
  const stationary = getPlayerInput(game, { fire: true, pointerAim: controls.pointerAim });
  assert.equal(stationary.moveX, 0);
  assert.equal(stationary.moveY, 0);
});

test('Demo targeting selects the nearest living enemy and retargets after a death', () => {
  const game = gameWith([enemy(1, 300, 100), enemy(2, 120, 100, { hp: 0 }), enemy(3, 200, 100)]);
  assert.equal(getAutoAim(game).targetId, 3);
  game.enemies[2].hp = 0;
  assert.equal(getAutoAim(game).targetId, 1);
  game.enemies[0].hp = 0;
  assert.equal(getAutoAim(game), null);
});

test('Demo equal-distance targets use the same ID even when their array order changes', () => {
  const game = gameWith([enemy(9, 200, 100), enemy(2, 100, 200)]);
  assert.equal(getAutoAim(game).targetId, 2);
  game.enemies.reverse();
  assert.equal(getAutoAim(game).targetId, 2);
});

test('Demo target leading uses enemy velocity and the selected bullet speed', () => {
  const game = gameWith([enemy(1, 720, 100, { vx: 10, vy: 20 })]);
  assert.deepEqual(getAutoAim(game), { aimX: 727, aimY: 114, targetId: 1 });
  const faster = getAutoAim(game, { fastBullets: true });
  const lead = 620 / 1100 * 0.7;
  close(faster.aimX, 720 + 10 * lead);
  close(faster.aimY, 100 + 20 * lead);
});

test('firing requires an explicit true input and stops on release', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  const controls = { pointerAim: { x: 0, y: 0 } };
  const held = getPlayerInput(game, { ...controls, fire: true });
  assert.equal(held.shoot, true);
  assert.equal(held.aimX, 0);
  assert.equal(held.aimY, 0);
  assert.equal(getPlayerInput(game, { ...controls, fire: false }).shoot, false);
  assert.equal(getPlayerInput(game, controls).shoot, false);
  assert.equal(getPlayerInput(game, { ...controls, fire: 1 }).shoot, false);
});

test('explicit fire works in an empty arena using the current facing direction', () => {
  const game = gameWith([]);
  game.player.angle = Math.PI / 2;
  const input = getPlayerInput(game, { fire: true });
  assert.equal(input.shoot, true);
  assert.equal(input.targetId, null);
  assert.equal(input.manualAim, true);
  close(input.aimX, 100);
  close(input.aimY, 260);
});

test('player aim does not follow enemies as they move or die', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  const controls = { pointerAim: { x: 450, y: 220 }, fire: true };
  const before = getPlayerInput(game, controls);
  Object.assign(game.enemies[0], { x: 110, y: 120, vx: 70, vy: 20 });
  assert.deepEqual(getPlayerInput(game, controls), before);
  game.enemies[0].hp = 0;
  assert.deepEqual(getPlayerInput(game, controls), before);
});

test('mouse aim without a pointer falls back to the current facing direction', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  game.player.angle = Math.PI;
  const input = getPlayerInput(game, { pointerAim: null });
  close(input.aimX, -60);
  close(input.aimY, 100);
  assert.equal(input.manualAim, true);
  assert.equal(input.shoot, false);
});

test('fallback aim recalculates from the current player position and heading', () => {
  const game = gameWith([]);
  assert.equal(getAutoAim(game), null);
  const idle = getPlayerInput(game);
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

test('explicit fire cannot shoot after the game ends', () => {
  const game = gameWith([enemy(1, 300, 100)]);
  game.phase = 'over';
  assert.equal(getPlayerInput(game, { fire: true, pointerAim: { x: 300, y: 100 } }).shoot, false);
});

test('player controls are deterministic and do not mutate their arguments', () => {
  const game = gameWith([enemy(1, 300, 100, { vx: -40, vy: 15 })]);
  const controls = { moveX: 1, fire: true, pointerAim: { x: 50, y: 60 } };
  const before = structuredClone({ game, controls });
  const first = getPlayerInput(game, controls);
  assert.deepEqual(getPlayerInput(game, controls), first);
  assert.deepEqual({ game, controls }, before);
});

test('Demo targeting does not mutate its arguments and ignores cosmetic flags', () => {
  const game = gameWith([enemy(1, 300, 100, { vx: -40, vy: 15 })]);
  const settings = { fastBullets: true };
  const before = structuredClone({ game, settings });
  const first = getAutoAim(game, settings);
  assert.deepEqual(getAutoAim(game, settings), first);
  assert.deepEqual(getAutoAim(game, {
    ...settings, animation: true, shake: true, sound: true,
    cameraEase: true, cameraLead: true, muzzleFlash: true, bigBullets: true,
  }), first);
  assert.deepEqual({ game, settings }, before);
});

test('a short game without player input never moves or shoots automatically', () => {
  const game = createGame();
  const start = { x: game.player.x, y: game.player.y };
  for (let frame = 0; frame < 720 && game.phase === 'playing'; frame++) {
    stepGame(game, getPlayerInput(game));
  }
  assert.equal(game.shots, 0);
  assert.equal(game.kills, 0);
  assert.equal(game.player.x, start.x);
  assert.equal(game.player.y, start.y);
});

test('holding fire at a fixed mouse aim scores a takedown, and releasing stops new shots', () => {
  const game = createGame();
  const controls = { pointerAim: { x: 180, y: 180 }, fire: true };
  for (let frame = 0; frame < 240; frame++) stepGame(game, getPlayerInput(game, controls));
  assert.ok(game.kills > 0);
  assert.ok(game.shots > 1);
  const shots = game.shots;
  controls.fire = false;
  for (let frame = 0; frame < 120; frame++) stepGame(game, getPlayerInput(game, controls));
  assert.equal(game.shots, shots);
});
