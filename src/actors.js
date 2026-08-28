import { actorPoint, GROUND_SCALE, HEIGHT_SCALE, SHOT_HEIGHT } from './projection.js';

const TAU = Math.PI * 2;
const INK = '#493626';

/** Smooth, height-aware character art. Coordinates are forward, sideways and up. */
export function drawActor(ctx, actor, { time, animation, recoil = 0, flash = false, fall = 0 }) {
  const fox = actor.kind === 'fox';
  const moving = Math.hypot(actor.vx, actor.vy) > 5;
  const phase = time * 16 + (typeof actor.id === 'number' ? actor.id : 0);
  const stride = animation && moving ? Math.sin(phase) : 0;
  const bob = animation && moving ? Math.abs(Math.cos(phase)) * 2.8 : 0;
  const point = (f, s, z) => actorPoint(f, s, z, actor.angle);
  const parts = [];
  const add = (depth, draw) => parts.push({ depth, draw });
  const colour = value => flash ? '#fff5d6' : value;

  // The silhouette of a projected ellipsoid is an ellipse, not a flattened sprite.
  function oval(f, s, z, rf, rs, rz, fill, outline = true) {
    const centre = point(f, s, z);
    const c = Math.cos(actor.angle), n = Math.sin(actor.angle);
    const a = (rf * c) ** 2 + (rs * n) ** 2;
    const b = (rf ** 2 - rs ** 2) * c * n * GROUND_SCALE;
    const d = (rf * n * GROUND_SCALE) ** 2 + (rs * c * GROUND_SCALE) ** 2 + (rz * HEIGHT_SCALE) ** 2;
    const spread = Math.hypot(a - d, 2 * b);
    const rx = Math.sqrt((a + d + spread) / 2);
    const ry = Math.sqrt(Math.max(.01, (a + d - spread) / 2));
    const rotation = Math.atan2(2 * b, a - d) / 2;
    add(centre.depth, () => {
      ctx.beginPath(); ctx.ellipse(centre.x, centre.y, rx, ry, rotation, 0, TAU);
      ctx.fillStyle = colour(fill); ctx.fill();
      if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke(); }
    });
  }

  function rod(from, to, width, fill, depthBias = 0) {
    const a = point(...from), b = point(...to);
    add((a.depth + b.depth) / 2 + depthBias, () => {
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = INK; ctx.lineWidth = width + 2; ctx.stroke();
      ctx.strokeStyle = colour(fill); ctx.lineWidth = width; ctx.stroke();
    });
  }

  function tail() {
    const wag = animation ? Math.sin(time * (moving ? 9 : 6)) * (moving ? .42 : .3) : 0;
    const tailPoint = (f, z) => actorPoint(f, 0, z + bob, actor.angle + wag);
    const base = point(-17, 0, 19 + bob);
    const middle = tailPoint(-43, 24);
    const tip = tailPoint(-73, 34);
    const length = Math.hypot(tip.x - base.x, tip.y - base.y);
    const nx = -(tip.y - base.y) / length, ny = (tip.x - base.x) / length;
    const offset = (p, width) => [p.x + nx * width, p.y + ny * width];
    const seam = { x: middle.x * .42 + tip.x * .58, y: middle.y * .42 + tip.y * .58 };
    add(middle.depth, () => {
      ctx.beginPath(); ctx.moveTo(...offset(base, 5));
      ctx.bezierCurveTo(...offset(middle, 24), ...offset(tip, 15), tip.x, tip.y);
      ctx.bezierCurveTo(...offset(tip, -13), ...offset(middle, -23), ...offset(base, -5));
      ctx.closePath();
      const fur = ctx.createLinearGradient(middle.x - 12, middle.y - 17, middle.x + 12, middle.y + 17);
      fur.addColorStop(0, colour('#f7a053')); fur.addColorStop(1, colour('#bc572f'));
      ctx.fillStyle = fur; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.beginPath(); ctx.moveTo(...offset(seam, 25));
      ctx.lineTo(...offset(tip, 25)); ctx.lineTo(tip.x - nx * 25 + (tip.x - middle.x), tip.y - ny * 25 + (tip.y - middle.y));
      ctx.lineTo(...offset(seam, -25));
      ctx.lineTo(seam.x - nx * 8 - (tip.x - middle.x) * .13, seam.y - ny * 8 - (tip.y - middle.y) * .13);
      ctx.lineTo(seam.x - (tip.x - middle.x) * .28, seam.y - (tip.y - middle.y) * .28);
      ctx.lineTo(seam.x + nx * 8, seam.y + ny * 8); ctx.closePath();
      ctx.fillStyle = colour('#fff0cf'); ctx.fill(); ctx.restore();
    });
  }

  function ear(side) {
    const a = point(-5, side * 7, 72 + bob);
    const b = point(-7, side * 15, 101 + bob);
    const c = point(9, side * 18, 73 + bob);
    const centre = point(-2, side * 12, 80 + bob);
    add(centre.depth, () => {
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(b.x - side * 3, b.y + 6, b.x, b.y);
      ctx.quadraticCurveTo(b.x + side * 5, b.y + 3, c.x, c.y);
      ctx.quadraticCurveTo(centre.x, centre.y + 9, a.x, a.y);
      ctx.fillStyle = colour('#e88743'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.stroke();
      const inset = p => [p.x * .6 + centre.x * .4, p.y * .6 + centre.y * .4];
      ctx.beginPath(); ctx.moveTo(...inset(a)); ctx.lineTo(...inset(b)); ctx.lineTo(...inset(c));
      ctx.closePath(); ctx.fillStyle = colour('#674232'); ctx.fill();
    });
  }

  function gun() {
    const muzzle = actor.radius + 9 - recoil;
    const z = SHOT_HEIGHT;
    // Keep the held weapon in front of the torso, while the head can still occlude it.
    rod([muzzle - 48, 0, z], [muzzle - 34, 0, z], 11, '#ac8058', 12);
    rod([muzzle - 31, 0, z - 7], [muzzle - 28, 0, z], 6, '#775840', 12);
    rod([muzzle - 33, 0, z], [muzzle - 14, 0, z], 11, '#546361', 12);
    rod([muzzle - 17, 0, z], [muzzle, 0, z], 7, '#aab4a8', 12);
    rod([muzzle - 3, 0, z], [muzzle, 0, z], 8, '#26362d', 12);
  }

  ctx.save();
  if (fall) { ctx.translate(0, fall * 13); ctx.rotate(fall * .95); }
  if (fox) {
    tail();
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      const step = stride * side * front * 5;
      oval(front * 10 + step, side * 9, 7, 5, 5, 9, '#403529');
      oval(front * 10 + step + 3, side * 9, 3, 7, 5, 3, '#403529');
    }
    oval(-4, 0, 31 + bob, 20, 14, 20, '#da763a');
    oval(8, 0, 36 + bob, 8, 12, 17, '#ffe7bd', false);
    oval(3, 0, 58 + bob, 17, 21, 18, '#f29a4c');
    ear(-1); ear(1);
    for (const side of [-1, 1]) {
      oval(15, side * 11, 52 + bob, 9, 11, 9, '#ffedcd', false);
      oval(16, side * 12, 62 + bob, 2.7, 2.8, 3, '#272d25', false);
      oval(17, side * 12, 63 + bob, .9, 1, 1, '#ffffff', false);
    }
    oval(23, 0, 50 + bob, 10, 8, 7, '#fff0d1', false);
    oval(31, 0, 52 + bob, 3.8, 4, 3.2, '#2c3027', false);
    oval(3, 7, 24, 6, 5, 6, '#49372a');
    gun();
  } else if (actor.kind === 'hunter') {
    for (const side of [-1, 1]) {
      oval(stride * side * 5, side * 8, 10, 6, 6, 11, '#363c2e');
      oval(4 + stride * side * 5, side * 8, 3, 9, 6, 3, '#30372b');
    }
    oval(-3, 0, 31 + bob, 13, 17, 21, '#77815b');
    oval(8, 0, 28 + bob, 6, 13, 13, '#889369', false);
    oval(0, 0, 55 + bob, 12, 14, 13, '#cfaa7a');
    oval(12, 0, 53 + bob, 5, 6, 5, '#d9b687', false);
    for (const side of [-1, 1]) oval(11, side * 6, 58 + bob, 1.5, 2, 2, '#30352b', false);
    oval(-2, 0, 66 + bob, 17, 22, 3, '#405943');
    oval(-5, 0, 72 + bob, 11, 15, 8, '#829466');
    oval(-2, 0, 69 + bob, 12, 15, 2, '#b9a06a', false);
    gun();
  } else {
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      oval(front * 13 + stride * side * front * 5, side * 8, 6, 5, 4, 7, '#514331');
    }
    rod([-19, 0, 17], [-38, stride * 4, 25], 5, '#a88b5f');
    oval(-3, 0, 17 + bob, 23, 12, 12, '#b79a69');
    oval(-7, 0, 23 + bob, 13, 10, 6, '#756044', false);
    oval(11, 0, 20 + bob, 4, 12, 13, '#b36046');
    oval(18, 0, 29 + bob, 12, 13, 11, '#d1b17a');
    for (const side of [-1, 1]) {
      oval(14, side * 12, 24 + bob, 6, 4, 11, '#796044');
      oval(25, side * 7, 32 + bob, 2, 2, 2, '#2c3028', false);
    }
    oval(29, 0, 24 + bob, 9, 7, 6, '#e2c99b', false);
    oval(37, 0, 26 + bob, 3, 4, 3, '#33352a', false);
  }
  parts.sort((a, b) => a.depth - b.depth);
  for (const part of parts) part.draw();
  ctx.restore();
}
