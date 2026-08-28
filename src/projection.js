export const VIEW = Object.freeze({ width: 1440, height: 900 });
export const ELEVATION = Math.PI / 4;
export const GROUND_SCALE = Math.sin(ELEVATION);
export const HEIGHT_SCALE = Math.cos(ELEVATION);
export const SHOT_HEIGHT = 24;

/** Project world coordinates without zoom, screen shake or other visual offsets. */
export function worldToView({ x, y, z = 0 }, camera) {
  return {
    x: VIEW.width / 2 + x - camera.x,
    y: VIEW.height / 2 + (y - camera.y) * GROUND_SCALE - z * HEIGHT_SCALE,
  };
}

/** Recover world x/y on the plane at the supplied height. */
export function viewToWorld({ x, y }, camera, z = 0) {
  return {
    x: x - VIEW.width / 2 + camera.x,
    y: (y - VIEW.height / 2 + z * HEIGHT_SCALE) / GROUND_SCALE + camera.y,
  };
}

export function projectedAngle(angle) {
  return Math.atan2(Math.sin(angle) * GROUND_SCALE, Math.cos(angle));
}

/** Rotate a local actor point, then project its position and drawing depth. */
export function actorPoint(forward, side, height, angle) {
  const x = forward * Math.cos(angle) - side * Math.sin(angle);
  const y = forward * Math.sin(angle) + side * Math.cos(angle);
  return {
    x,
    y: y * GROUND_SCALE - height * HEIGHT_SCALE,
    depth: y * HEIGHT_SCALE + height * GROUND_SCALE,
  };
}
