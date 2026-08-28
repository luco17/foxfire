import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW, ELEVATION, GROUND_SCALE, HEIGHT_SCALE, SHOT_HEIGHT,
  worldToView, viewToWorld, projectedAngle, actorPoint,
} from '../src/projection.js';

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);
}

test('the projection uses a 45-degree elevation and preserves the camera centre', () => {
  assert.equal(ELEVATION, Math.PI / 4);
  close(GROUND_SCALE, Math.SQRT1_2);
  close(HEIGHT_SCALE, Math.SQRT1_2);
  const camera = { x: 640, y: 400 };
  assert.deepEqual(worldToView(camera, camera), { x: VIEW.width / 2, y: VIEW.height / 2 });
  const raised = worldToView({ ...camera, z: SHOT_HEIGHT }, camera);
  close(raised.x, VIEW.width / 2);
  close(raised.y, VIEW.height / 2 - SHOT_HEIGHT * HEIGHT_SCALE);
});

test('ground and shot-height positions round trip through offset cameras', () => {
  const cameras = [{ x: 0, y: 0 }, { x: 640, y: 400 }, { x: -83.5, y: 921.25 }];
  const points = [{ x: 0, y: 0 }, { x: 1280, y: 800 }, { x: 373.25, y: 412.75 }];
  for (const camera of cameras) {
    for (const point of points) {
      for (const z of [0, SHOT_HEIGHT]) {
        const recovered = viewToWorld(worldToView({ ...point, z }, camera), camera, z);
        close(recovered.x, point.x);
        close(recovered.y, point.y);
      }
    }
  }
});

test('inverse projection uses the selected height rather than treating raised shots as ground points', () => {
  const camera = { x: 640, y: 400 };
  const point = { x: 500, y: 320, z: SHOT_HEIGHT };
  const projected = worldToView(point, camera);
  const onGround = viewToWorld(projected, camera);
  const atShotHeight = viewToWorld(projected, camera, SHOT_HEIGHT);
  close(onGround.y, point.y - SHOT_HEIGHT * HEIGHT_SCALE / GROUND_SCALE);
  close(atShotHeight.y, point.y);
  close(atShotHeight.x, point.x);
});

test('projected angles follow projected ground directions, including diagonals', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -2.1]) {
    const direction = actorPoint(1, 0, 0, angle);
    close(projectedAngle(angle), Math.atan2(direction.y, direction.x));
  }
  close(projectedAngle(Math.PI / 4), Math.atan(GROUND_SCALE));
  assert.ok(projectedAngle(Math.PI / 4) < Math.PI / 4);
});

test('local feet and raised actor points agree with world projection at non-cardinal headings', () => {
  const camera = { x: 612.5, y: 388 };
  const origin = { x: 373, y: 412 };
  const centre = worldToView(origin, camera);
  for (const angle of [Math.PI / 5, -2.1]) {
    for (const [forward, side, height] of [[12, 8, 0], [-12, -8, 0], [17, 5, SHOT_HEIGHT]]) {
      const local = actorPoint(forward, side, height, angle);
      const point = {
        x: origin.x + forward * Math.cos(angle) - side * Math.sin(angle),
        y: origin.y + forward * Math.sin(angle) + side * Math.cos(angle),
        z: height,
      };
      const projected = worldToView(point, camera);
      close(local.x, projected.x - centre.x);
      close(local.y, projected.y - centre.y);
      const recovered = viewToWorld({ x: centre.x + local.x, y: centre.y + local.y }, camera, height);
      close(recovered.x, point.x);
      close(recovered.y, point.y);
    }
  }
});

test('actor depth includes ground direction and height independently of screen position', () => {
  const angle = 0.7;
  const ground = actorPoint(12, -4, 0, angle);
  const raised = actorPoint(12, -4, SHOT_HEIGHT, angle);
  const groundY = 12 * Math.sin(angle) - 4 * Math.cos(angle);
  close(ground.depth, groundY * HEIGHT_SCALE);
  close(raised.x, ground.x);
  close(raised.y - ground.y, -SHOT_HEIGHT * HEIGHT_SCALE);
  close(raised.depth - ground.depth, SHOT_HEIGHT * GROUND_SCALE);
});

test('projection does not mutate its points or camera', () => {
  const camera = Object.freeze({ x: 630, y: 385 });
  const point = Object.freeze({ x: 711, y: 302, z: SHOT_HEIGHT });
  const projected = Object.freeze(worldToView(point, camera));
  const first = viewToWorld(projected, camera, point.z);
  assert.deepEqual(viewToWorld(projected, camera, point.z), first);
  assert.deepEqual(camera, { x: 630, y: 385 });
  assert.deepEqual(point, { x: 711, y: 302, z: SHOT_HEIGHT });
});
