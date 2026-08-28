import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRenderer } from '../src/render.js';
import { drawActor } from '../src/actors.js';
import { VIEW, SHOT_HEIGHT, worldToView } from '../src/projection.js';

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);
}

function rendererAt(rect, camera) {
  const renderer = Object.create(GameRenderer.prototype);
  renderer.canvas = { getBoundingClientRect: () => rect };
  renderer.camera = camera;
  return renderer;
}

function actor(kind, moving = false) {
  return {
    id: kind === 'fox' ? 'player' : 1, kind, x: 350, y: 420,
    radius: kind === 'fox' ? 17 : kind === 'hunter' ? 20 : 18,
    angle: 0.65, vx: moving ? 118 : 0, vy: moving ? 40 : 0,
  };
}

// Record drawing operations without depending on a browser, colours or shape counts.
function drawingCommands(subject, options) {
  const commands = [];
  const ctx = {};
  for (const name of [
    'save', 'restore', 'translate', 'rotate', 'beginPath', 'closePath',
    'ellipse', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
    'fill', 'stroke', 'clip',
  ]) ctx[name] = (...args) => commands.push([name, ...args]);
  ctx.createLinearGradient = (...args) => {
    commands.push(['createLinearGradient', ...args]);
    return { addColorStop() {} };
  };
  drawActor(ctx, subject, options);
  return commands;
}

test('client coordinates round trip shot-height world positions across canvas sizes and camera offsets', () => {
  const rects = [
    { left: 0, top: 0, width: 1440, height: 900 },
    { left: 73.5, top: 168, width: 720, height: 450 },
    { left: -21, top: 94.25, width: 1017.25, height: 635.78125 },
  ];
  const cameras = [{ x: 640, y: 400 }, { x: 612.5, y: 437.75 }, { x: 0, y: 0 }];
  const points = [{ x: 25, y: 25 }, { x: 1255, y: 775 }, { x: 377.13, y: 291.6 }];
  for (const rect of rects) {
    for (const camera of cameras) {
      const renderer = rendererAt(rect, camera);
      for (const point of points) {
        const view = worldToView({ ...point, z: SHOT_HEIGHT }, camera);
        const clientX = rect.left + view.x / VIEW.width * rect.width;
        const clientY = rect.top + view.y / VIEW.height * rect.height;
        const recovered = renderer.screenToWorld(clientX, clientY);
        close(recovered.x, point.x);
        close(recovered.y, point.y);
      }
    }
  }
});

test('camera shake and cosmetic recoil cannot perturb pointer aiming', () => {
  const renderer = rendererAt({ left: 50, top: 90, width: 800, height: 500 }, { x: 660, y: 380 });
  const before = renderer.screenToWorld(470, 330);
  renderer.shake = 9;
  renderer.kick = { x: -16, y: 13 };
  renderer.recoil = 17;
  renderer.fxTime = 1.7;
  assert.deepEqual(renderer.screenToWorld(470, 330), before);
});

test('disabling animation freezes moving and stationary actor drawings across time', () => {
  for (const kind of ['fox', 'hunter', 'hound']) {
    for (const moving of [false, true]) {
      const subject = actor(kind, moving);
      const early = drawingCommands(subject, { time: 0, animation: false });
      const later = drawingCommands(subject, { time: 0.37, animation: false });
      assert.deepEqual(later, early, `${kind}, moving=${moving}`);
    }
  }
});

test('an animated stationary fox wags its tail as time advances', () => {
  const subject = actor('fox');
  const early = drawingCommands(subject, { time: 0, animation: true });
  const later = drawingCommands(subject, { time: 0.2, animation: true });
  assert.notDeepEqual(later, early);
});

test('an animated moving hunter has a changing gait while a stationary hunter stays still', () => {
  const moving = actor('hunter', true);
  assert.notDeepEqual(
    drawingCommands(moving, { time: 0, animation: true }),
    drawingCommands(moving, { time: 0.2, animation: true }),
  );
  const stationary = actor('hunter');
  assert.deepEqual(
    drawingCommands(stationary, { time: 0, animation: true }),
    drawingCommands(stationary, { time: 0.2, animation: true }),
  );
});

test('actor drawing does not mutate actors or presentation options', () => {
  const options = Object.freeze({ time: 0.27, animation: true, recoil: 12, flash: true, fall: 0.4 });
  for (const kind of ['fox', 'hunter', 'hound']) {
    const subject = Object.freeze(actor(kind, true));
    const before = structuredClone(subject);
    drawingCommands(subject, options);
    assert.deepEqual(subject, before);
  }
  assert.deepEqual(options, { time: 0.27, animation: true, recoil: 12, flash: true, fall: 0.4 });
});
