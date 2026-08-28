import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRenderer } from '../src/render.js';
import { drawActor, drawFallenActor } from '../src/actors.js';
import { createGame } from '../src/game.js';
import { VIEW, GROUND_SCALE, SHOT_HEIGHT, worldToView } from '../src/projection.js';

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);
}

function rendererAt(rect = { left: 0, top: 0, width: VIEW.width, height: VIEW.height }, camera = { x: 640, y: 400 }) {
  const renderer = Object.create(GameRenderer.prototype);
  renderer.canvas = { width: VIEW.width, height: VIEW.height, getBoundingClientRect: () => rect };
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
function recordingContext() {
  const commands = [];
  const ctx = {};
  for (const name of [
    'save', 'restore', 'translate', 'rotate', 'beginPath', 'closePath',
    'ellipse', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
    'fill', 'stroke', 'clip', 'setTransform', 'scale', 'drawImage',
    'fillRect', 'strokeRect', 'arc', 'setLineDash',
  ]) ctx[name] = (...args) => commands.push([name, ...args]);
  ctx.createLinearGradient = (...args) => {
    commands.push(['createLinearGradient', ...args]);
    return { addColorStop() {} };
  };
  return { ctx, commands };
}

function drawingCommands(subject, options) {
  const { ctx, commands } = recordingContext();
  drawActor(ctx, subject, options);
  return commands;
}

function fallenCommands(corpse) {
  const { ctx, commands } = recordingContext();
  drawFallenActor(ctx, corpse);
  return commands;
}

function shot(angle = 0) {
  return { type: 'shot', owner: 'player', x: 700, y: 430, angle };
}

function death(kind = 'hunter', id = 1) {
  return { type: 'death', kind, id, x: 350, y: 420, angle: 0.65 };
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

test('fallen hunter and hound art is distinct, deterministic and local without mutating corpse records', () => {
  const drawings = [];
  for (const kind of ['hunter', 'hound']) {
    const corpse = Object.freeze({ kind, id: 7, x: 350, y: 420, angle: 0.65 });
    const before = structuredClone(corpse);
    const commands = fallenCommands(corpse);
    assert.ok(commands.some(command => ['fill', 'stroke', 'fillRect'].includes(command[0])));
    assert.deepEqual(fallenCommands(corpse), commands);
    assert.deepEqual(fallenCommands({ ...corpse, x: 830, y: 190, angle: -1.2 }), commands,
      'world placement belongs to the renderer, not the local fallen art');
    assert.deepEqual(corpse, before);
    drawings.push(commands);
  }
  assert.notDeepEqual(drawings[0], drawings[1]);
});

test('death records remain unchanged while hidden and after updates without changing game state or events', () => {
  const renderer = rendererAt();
  renderer.reset();
  const events = Object.freeze([
    Object.freeze(death('hunter', 7)),
    Object.freeze({ ...death('hound', 9), x: 820, y: 210, angle: -0.4 }),
  ]);
  const game = createGame();
  const before = structuredClone({ game, events });
  renderer.consume(events, { remains: false });
  const expected = events.map(event => ({ ...event, angle: event.angle + 0.5 }));
  assert.deepEqual(renderer.corpses, expected);
  for (let index = 0; index < events.length; index++) assert.notEqual(renderer.corpses[index], events[index]);
  renderer.update(game, {}, { remains: false }, 1);
  renderer.update(game, {}, { remains: true }, 1);
  assert.deepEqual(renderer.corpses, expected);
  assert.deepEqual({ game, events }, before);
});

test('fallen bodies retain the newest 100 death records and reset clears them', () => {
  const renderer = rendererAt();
  renderer.reset();
  const events = Array.from({ length: 105 }, (_, index) => death(index % 2 ? 'hunter' : 'hound', index + 1));
  renderer.consume(events, { remains: false });
  assert.equal(renderer.corpses.length, 100);
  assert.deepEqual(renderer.corpses.map(corpse => corpse.id), events.slice(-100).map(event => event.id));
  renderer.reset();
  assert.deepEqual(renderer.corpses, []);
  renderer.consume([death('hunter', 200)], { remains: true });
  assert.deepEqual(renderer.corpses.map(corpse => corpse.id), [200]);
});

test('the remains toggle reveals stored bodies on the floor before live actors and hides all corpse drawing', () => {
  const renderer = rendererAt();
  renderer.reset();
  renderer.consume([death('hunter', 7), death('hound', 9)], { remains: false });
  const before = structuredClone(renderer.corpses);
  const { ctx, commands } = recordingContext();
  renderer.ctx = ctx;
  renderer.ground = {};
  renderer.actor = subject => commands.push(['actor', subject.id]);
  renderer.drawCorpse = corpse => commands.push(['corpse', corpse.id]);
  const game = createGame();
  renderer.draw(game, {}, { remains: true });
  const ground = commands.findIndex(command => command[0] === 'drawImage');
  const firstActor = commands.findIndex(command => command[0] === 'actor');
  assert.ok(ground >= 0 && firstActor > ground);
  assert.deepEqual(commands.filter(command => command[0] === 'corpse').map(command => command[1]), [7, 9]);
  for (let index = 0; index < commands.length; index++) {
    if (commands[index][0] === 'corpse') assert.ok(index > ground && index < firstActor);
  }
  assert.deepEqual(renderer.corpses, before);
  commands.length = 0;
  renderer.draw(game, {}, { remains: false });
  const hidden = structuredClone(commands);
  commands.length = 0;
  renderer.corpses = [];
  renderer.draw(game, {}, { remains: false });
  assert.deepEqual(hidden, commands);
});

test('corpse drawing applies its recorded ground position and angle exactly once without height or health overlays', () => {
  const renderer = rendererAt();
  for (const kind of ['hunter', 'hound']) {
    for (const angle of [0, 0.67, -1.2]) {
      const corpse = Object.freeze({ kind, id: 7, x: 413.5, y: 302.25, angle });
      const { ctx, commands } = recordingContext();
      renderer.ctx = ctx;
      renderer.drawCorpse(corpse);
      assert.deepEqual(commands, [
        ['save'], ['translate', corpse.x, corpse.y], ['rotate', angle],
        ...fallenCommands(corpse), ['restore'],
      ]);
    }
  }
});

test('player casings spawn at the rotated receiver and eject sideways and backwards, even when hidden', () => {
  for (const gunRecoil of [false, true]) {
    let referenceVelocity;
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.67]) {
      const renderer = rendererAt();
      renderer.reset();
      const event = shot(angle);
      renderer.consume([{ ...event, owner: 'hunter' }], { casings: true, gunRecoil });
      assert.equal(renderer.casings.length, 0, 'hunters must not add player casings');
      renderer.consume([event], { casings: false, gunRecoil });
      assert.equal(renderer.casings.length, 1);
      const casing = renderer.casings[0];
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const dx = casing.x - event.x, dy = casing.y - event.y;
      close(dx * cos + dy * sin, -(24 + (gunRecoil ? 17 : 0)));
      close(-dx * sin + dy * cos, 7);
      close(casing.z, SHOT_HEIGHT);
      const forward = casing.vx * cos + casing.vy * sin;
      const sideways = -casing.vx * sin + casing.vy * cos;
      assert.ok(forward < 0 && sideways > Math.abs(forward));
      assert.ok(casing.vz > 0);
      assert.equal(casing.bounces, 0);
      assert.equal(casing.settled, false);
      referenceVelocity ??= { forward, sideways };
      close(forward, referenceVelocity.forward);
      close(sideways, referenceVelocity.sideways);
    }
  }
});

test('a casing rises, falls, makes one damped bounce and then stays still on the floor', () => {
  const renderer = rendererAt();
  renderer.reset();
  renderer.consume([shot(0.4)], { casings: true });
  const game = createGame();
  const casing = renderer.casings[0];
  const start = structuredClone(casing);
  let firstPeak = casing.z, bouncePeak = 0, bounceCount = 0, falling = false;
  for (let frame = 0; frame < 600 && !casing.settled; frame++) {
    const previous = { ...casing };
    renderer.update(game, {}, { casings: true }, 1 / 120);
    assert.ok(casing.z >= 0);
    falling ||= casing.vz < 0;
    if (casing.bounces === 0) firstPeak = Math.max(firstPeak, casing.z);
    else bouncePeak = Math.max(bouncePeak, casing.z);
    if (casing.bounces !== previous.bounces) {
      bounceCount++;
      assert.equal(casing.bounces, 1);
      assert.ok(casing.vz > 0 && casing.vz < Math.abs(previous.vz));
      assert.ok(Math.hypot(casing.vx, casing.vy) < Math.hypot(previous.vx, previous.vy));
      assert.ok(Math.abs(casing.spin) < Math.abs(previous.spin));
    }
  }
  assert.ok(firstPeak > start.z && falling);
  assert.ok(bouncePeak > 0 && bouncePeak < firstPeak);
  assert.equal(bounceCount, 1);
  assert.equal(casing.settled, true);
  assert.equal(casing.z, 0);
  assert.ok(Math.hypot(casing.x - start.x, casing.y - start.y) > 0);
  assert.notEqual(casing.angle, start.angle);
  for (const key of ['vx', 'vy', 'vz', 'spin']) assert.equal(casing[key], 0);
  const settled = structuredClone(casing);
  renderer.update(game, {}, { casings: true }, 1);
  assert.deepEqual(casing, settled);
});

test('zero visual time freezes airborne casings and casings exactly at ground contact', () => {
  const renderer = rendererAt();
  renderer.reset();
  renderer.consume([shot(), shot(0.7)], { casings: true });
  Object.assign(renderer.casings[1], { z: 0, vz: -30 });
  const before = structuredClone(renderer.casings);
  renderer.update(createGame(), {}, { casings: true }, 0);
  assert.deepEqual(renderer.casings, before);
});

test('hidden casings follow the same trajectory without changing game state or shot events', () => {
  const visible = rendererAt(), hidden = rendererAt();
  visible.reset(); hidden.reset();
  const game = createGame();
  const events = Object.freeze([Object.freeze(shot(1.2))]);
  const before = structuredClone({ game, events });
  visible.consume(events, { casings: true });
  hidden.consume(events, { casings: false });
  for (let frame = 0; frame < 240; frame++) {
    visible.update(game, {}, { casings: true }, 1 / 120);
    hidden.update(game, {}, { casings: false }, 1 / 120);
    assert.deepEqual(hidden.casings, visible.casings);
  }
  assert.equal(hidden.casings[0].settled, true);
  assert.deepEqual({ game, events }, before);
});

test('casings keep the newest 600 shots and reset removes all previous brass', () => {
  const renderer = rendererAt();
  renderer.reset();
  const events = Array.from({ length: 610 }, (_, index) => ({ ...shot(), x: 300 + index }));
  renderer.consume(events, { casings: false });
  assert.equal(renderer.casings.length, 600);
  close(renderer.casings[0].x, events[10].x - 24);
  close(renderer.casings.at(-1).x, events.at(-1).x - 24);
  renderer.update(createGame(), {}, {}, 0.2);
  renderer.reset();
  assert.deepEqual(renderer.casings, []);
  renderer.consume([shot()], { casings: true });
  assert.equal(renderer.casings.length, 1);
  assert.equal(renderer.casings[0].z, SHOT_HEIGHT);
  assert.equal(renderer.casings[0].settled, false);
});

test('settled casings and shadows draw before actors, flying brass draws above them, and the toggle hides both', () => {
  const renderer = rendererAt();
  renderer.reset();
  renderer.consume([shot(), shot(1)], { casings: true });
  const [flying, settled] = renderer.casings;
  Object.assign(settled, { settled: true, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 });
  const before = structuredClone(renderer.casings);
  const { ctx, commands } = recordingContext();
  renderer.ctx = ctx;
  renderer.ground = {};
  renderer.actor = subject => commands.push(['actor', subject.id]);
  renderer.drawCasing = casing => commands.push(['casing', casing === settled ? 'settled' : 'flying']);
  const game = createGame();
  renderer.draw(game, {}, { casings: true });
  const firstActor = commands.findIndex(command => command[0] === 'actor');
  const lastActor = commands.findLastIndex(command => command[0] === 'actor');
  const settledDraw = commands.findIndex(command => command[0] === 'casing' && command[1] === 'settled');
  const flyingDraw = commands.findIndex(command => command[0] === 'casing' && command[1] === 'flying');
  assert.ok(firstActor >= 0);
  assert.ok(settledDraw >= 0 && settledDraw < firstActor);
  assert.ok(flyingDraw > lastActor);
  for (const casing of [flying, settled]) {
    const shadow = commands.findIndex(command => command[0] === 'ellipse' && Math.hypot(command[1] - casing.x, command[2] - casing.y) < 8);
    assert.ok(shadow >= 0 && shadow < firstActor);
  }
  assert.deepEqual(renderer.casings, before);
  commands.length = 0;
  renderer.draw(game, {}, { casings: false });
  const hidden = structuredClone(commands);
  commands.length = 0;
  renderer.casings = [];
  renderer.draw(game, {}, { casings: false });
  assert.deepEqual(hidden, commands, 'hidden casings must not leave shapes or shadows');
});

test('casing height projects above its ground position without mutating the casing', () => {
  const renderer = rendererAt();
  renderer.reset();
  renderer.camera = { x: 617, y: 431 };
  for (const z of [0, SHOT_HEIGHT, 71]) {
    const casing = Object.freeze({ x: 413, y: 302, z, angle: 0.65, settled: z === 0 });
    const { ctx, commands } = recordingContext();
    renderer.ctx = ctx;
    renderer.drawCasing(casing);
    // Follow the canvas transform up to the first paint; shape sizes and colours do not matter.
    let [a, b, c, d, e, f] = [1, 0, 0, GROUND_SCALE, VIEW.width / 2 - renderer.camera.x, VIEW.height / 2 - renderer.camera.y * GROUND_SCALE];
    let painted = false;
    for (const [operation, x, y] of commands) {
      if (operation === 'translate') { e += a * x + c * y; f += b * x + d * y; }
      if (operation === 'scale') { a *= x; b *= x; c *= y; d *= y; }
      if (operation === 'rotate') {
        const cos = Math.cos(x), sin = Math.sin(x);
        [a, b, c, d] = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin];
      }
      if (operation === 'fillRect') {
        const expected = worldToView(casing, renderer.camera);
        close(e, expected.x); close(f, expected.y);
        painted = true;
        break;
      }
    }
    assert.ok(painted);
  }
});
