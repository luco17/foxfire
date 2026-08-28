// The simulation owns combat only. Rendering, sound and time effects live outside it.
export const WORLD = Object.freeze({ width: 1280, height: 800 });
export const FIXED_STEP = 1 / 120;

const EDGE = 25;
const MAX_ENEMIES = 40;
const PLAYER_SPEED = 260;
const EPSILON = 1e-9;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function random(state) {
  let value = state.rngState;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 4294967296;
}

function addEnemy(state, kind, x, y) {
  const hp = kind === 'hound' ? 2 : 3;
  const enemy = {
    id: state.nextId++, kind, x, y,
    radius: kind === 'hound' ? 18 : 20,
    hp, maxHp: hp, angle: 0, vx: 0, vy: 0,
    cooldown: kind === 'hunter' ? 1.2 : 0,
    telegraph: 0,
  };
  state.enemies.push(enemy);
  return enemy;
}

export function createGame(seed = 1337) {
  const initialSeed = (Number(seed) >>> 0) || 1;
  const state = {
    seed: initialSeed,
    rngState: initialSeed,
    time: 0,
    phase: 'playing',
    player: {
      x: WORLD.width / 2, y: WORLD.height / 2, radius: 17,
      hp: 5, maxHp: 5, angle: 0, vx: 0, vy: 0,
      invulnerable: 0, cooldown: 0,
    },
    enemies: [],
    bullets: [],
    kills: 0,
    shots: 0,
    nextId: 1,
    spawnTimer: 2.7,
    events: [],
  };
  addEnemy(state, 'hound', 180, 180);
  addEnemy(state, 'hunter', 1090, 190);
  addEnemy(state, 'hound', 1080, 650);
  return state;
}

/** Return the first intersection on a segment, as a fraction from 0 to 1. */
export function segmentCircleIntersection(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const ox = x1 - cx;
  const oy = y1 - cy;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a <= EPSILON) return null;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function boundaryIntersection(x1, y1, x2, y2) {
  if (x1 < 0 || x1 > WORLD.width || y1 < 0 || y1 > WORLD.height) return 0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let first = Infinity;
  if (x2 <= 0 && dx < 0) first = Math.min(first, -x1 / dx);
  if (x2 >= WORLD.width && dx > 0) first = Math.min(first, (WORLD.width - x1) / dx);
  if (y2 <= 0 && dy < 0) first = Math.min(first, -y1 / dy);
  if (y2 >= WORLD.height && dy > 0) first = Math.min(first, (WORLD.height - y1) / dy);
  return first;
}

function clampActor(actor) {
  actor.x = clamp(actor.x, EDGE, WORLD.width - EDGE);
  actor.y = clamp(actor.y, EDGE, WORLD.height - EDGE);
}

function addBullet(state, owner, actor, angle, speed) {
  const muzzle = actor.radius + 9;
  const x = clamp(actor.x + Math.cos(angle) * muzzle, 0, WORLD.width);
  const y = clamp(actor.y + Math.sin(angle) * muzzle, 0, WORLD.height);
  state.bullets.push({
    id: state.nextId++, owner, x, y, prevX: x, prevY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: owner === 'player' ? 4 : 5,
    life: owner === 'player' ? 2.2 : 5,
  });
  // A volley emits one event per projectile; shots counts player projectiles.
  state.events.push({ type: 'shot', owner, x, y, angle });
  if (owner === 'player') state.shots++;
}

function updatePlayer(state, input, settings, dt) {
  const player = state.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.cooldown = Math.max(0, player.cooldown - dt);
  let moveX = Number.isFinite(input.moveX) ? input.moveX : 0;
  let moveY = Number.isFinite(input.moveY) ? input.moveY : 0;
  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveY /= magnitude;
  }
  player.vx = moveX * PLAYER_SPEED;
  player.vy = moveY * PLAYER_SPEED;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  clampActor(player);
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) {
    const aimX = input.aimX - player.x;
    const aimY = input.aimY - player.y;
    if (Math.hypot(aimX, aimY) > EPSILON) player.angle = Math.atan2(aimY, aimX);
  }
  if (!input.shoot || player.cooldown > EPSILON) return;
  player.cooldown = settings.rapidFire === true ? 0.085 : 0.22;
  const speed = settings.fastBullets === true ? 1100 : 620;
  const angles = settings.tripleShot === true ? [-0.15, 0, 0.15] : [0];
  for (const offset of angles) {
    const scatter = settings.spread === true ? (random(state) - 0.5) * 0.22 : 0;
    addBullet(state, 'player', player, player.angle + offset + scatter, speed);
  }
  if (settings.playerRecoil === true) {
    player.x -= Math.cos(player.angle) * 7;
    player.y -= Math.sin(player.angle) * 7;
    clampActor(player);
  }
}

function spawnAtEdge(state) {
  let x = 40;
  let y = 40;
  let safe = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const edge = Math.floor(random(state) * 4);
    x = edge === 0 ? 40 : edge === 1 ? WORLD.width - 40 : 40 + random(state) * (WORLD.width - 80);
    y = edge === 2 ? 40 : edge === 3 ? WORLD.height - 40 : 40 + random(state) * (WORLD.height - 80);
    safe = Math.hypot(x - state.player.x, y - state.player.y) >= 330
      && state.enemies.every(enemy => Math.hypot(x - enemy.x, y - enemy.y) >= 65);
    if (safe) break;
  }
  if (!safe) {
    // The furthest corner always gives the player room, even when an edge is crowded.
    x = state.player.x < WORLD.width / 2 ? WORLD.width - 40 : 40;
    y = state.player.y < WORLD.height / 2 ? WORLD.height - 40 : 40;
  }
  addEnemy(state, random(state) < 0.62 ? 'hound' : 'hunter', x, y);
}

function updateSpawns(state, settings, dt) {
  state.spawnTimer -= dt * (settings.moreEnemies === true ? 2.2 : 1);
  if (state.spawnTimer > 0) return;
  const count = settings.moreEnemies === true ? 2 : 1;
  for (let index = 0; index < count && state.enemies.length < MAX_ENEMIES; index++) {
    spawnAtEdge(state);
  }
  state.spawnTimer = Math.max(1.2, 2.7 - state.time * 0.008);
}

function updateEnemies(state, settings, dt) {
  const speedMultiplier = settings.fastEnemies === true ? 1.6 : 1;
  for (const enemy of state.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const nx = distance > EPSILON ? dx / distance : 1;
    const ny = distance > EPSILON ? dy / distance : 0;
    enemy.angle = Math.atan2(ny, nx);
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    let speed = enemy.kind === 'hound' ? 118 : distance > 335 ? 68 : distance < 235 ? -48 : 0;
    if (enemy.kind === 'hunter') {
      if (enemy.telegraph > 0) {
        enemy.telegraph = Math.max(0, enemy.telegraph - dt);
        speed = 0;
        if (enemy.telegraph <= EPSILON) {
          addBullet(state, 'hunter', enemy, enemy.angle, 260);
          enemy.cooldown = 1.9;
          enemy.telegraph = 0;
        }
      } else if (enemy.cooldown <= EPSILON && distance < 650) {
        enemy.telegraph = 0.55;
        speed = 0;
      }
    }
    enemy.vx = nx * speed * speedMultiplier;
    enemy.vy = ny * speed * speedMultiplier;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    clampActor(enemy);
  }
  // Two small position passes keep packs readable without a physics engine.
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < state.enemies.length; a++) {
      for (let b = a + 1; b < state.enemies.length; b++) {
        const first = state.enemies[a];
        const second = state.enemies[b];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distance = Math.hypot(dx, dy);
        const wanted = first.radius + second.radius + 4;
        if (distance >= wanted) continue;
        const nx = distance > EPSILON ? dx / distance : 1;
        const ny = distance > EPSILON ? dy / distance : 0;
        const correction = (wanted - distance) / 2;
        first.x -= nx * correction;
        first.y -= ny * correction;
        second.x += nx * correction;
        second.y += ny * correction;
        clampActor(first);
        clampActor(second);
      }
    }
  }
}

function damagePlayer(state, x, y, angle) {
  const player = state.player;
  if (state.phase !== 'playing' || player.invulnerable > EPSILON) return false;
  player.hp = Math.max(0, player.hp - 1);
  player.invulnerable = 0.8;
  const lethal = player.hp === 0;
  state.events.push({ type: 'hit', target: 'player', x, y, angle, lethal });
  if (lethal) {
    state.phase = 'over';
    state.events.push({ type: 'gameover', x: player.x, y: player.y });
  }
  return true;
}

function contactPoint(actor, bulletX, bulletY, angle) {
  const dx = bulletX - actor.x;
  const dy = bulletY - actor.y;
  const distance = Math.hypot(dx, dy);
  const nx = distance > EPSILON ? dx / distance : -Math.cos(angle);
  const ny = distance > EPSILON ? dy / distance : -Math.sin(angle);
  return { x: actor.x + nx * actor.radius, y: actor.y + ny * actor.radius };
}

function updateBullets(state, settings, dt) {
  const surviving = [];
  for (let index = 0; index < state.bullets.length; index++) {
    const bullet = state.bullets[index];
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    const travelTime = Math.min(dt, Math.max(0, bullet.life));
    const endX = bullet.x + bullet.vx * travelTime;
    const endY = bullet.y + bullet.vy * travelTime;
    const angle = Math.atan2(bullet.vy, bullet.vx);
    bullet.life -= dt;
    let first = boundaryIntersection(bullet.x, bullet.y, endX, endY);
    let target = null;
    const actors = bullet.owner === 'player' ? state.enemies : [state.player];
    for (const actor of actors) {
      if (actor.hp <= 0) continue;
      const t = segmentCircleIntersection(bullet.x, bullet.y, endX, endY, actor.x, actor.y, actor.radius + bullet.radius);
      if (t !== null && t < first) {
        first = t;
        target = actor;
      }
    }
    if (first !== Infinity) {
      bullet.x += (endX - bullet.x) * first;
      bullet.y += (endY - bullet.y) * first;
      if (!target) {
        state.events.push({ type: 'impact', x: bullet.x, y: bullet.y, angle });
      } else if (bullet.owner === 'hunter') {
        const point = contactPoint(target, bullet.x, bullet.y, angle);
        if (!damagePlayer(state, point.x, point.y, angle)) {
          state.events.push({ type: 'impact', ...point, angle });
        }
        if (state.phase === 'over') {
          surviving.push(...state.bullets.slice(index + 1));
          break;
        }
      } else {
        const point = contactPoint(target, bullet.x, bullet.y, angle);
        target.hp = settings.lowHp === true ? 0 : Math.max(0, target.hp - 1);
        const lethal = target.hp === 0;
        state.events.push({ type: 'hit', target: 'enemy', kind: target.kind, id: target.id, ...point, angle, lethal });
        if (lethal) {
          state.kills++;
          state.events.push({ type: 'death', kind: target.kind, id: target.id, x: target.x, y: target.y, angle });
        } else if (settings.enemyKnockback === true) {
          target.x += Math.cos(angle) * 26;
          target.y += Math.sin(angle) * 26;
          clampActor(target);
        }
      }
      continue;
    }
    bullet.x = endX;
    bullet.y = endY;
    if (bullet.life > 0) surviving.push(bullet);
  }
  state.bullets = surviving;
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
}

function updateContacts(state) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (state.phase !== 'playing') return;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    const wanted = player.radius + enemy.radius;
    if (distance > wanted) continue;
    const nx = distance > EPSILON ? dx / distance : 1;
    const ny = distance > EPSILON ? dy / distance : 0;
    damagePlayer(state, player.x + nx * player.radius, player.y + ny * player.radius, Math.atan2(-ny, -nx));
    if (state.phase !== 'playing') return;
    enemy.x = player.x + nx * wanted;
    enemy.y = player.y + ny * wanted;
    clampActor(enemy);
  }
}

/** Mutate combat state by one fixed step and return this step's fresh events. */
export function stepGame(state, input = {}, settings = {}, dt = FIXED_STEP) {
  state.events = [];
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return state.events;
  state.time += dt;
  updatePlayer(state, input, settings, dt);
  updateSpawns(state, settings, dt);
  updateEnemies(state, settings, dt);
  updateBullets(state, settings, dt);
  updateContacts(state);
  return state.events;
}
