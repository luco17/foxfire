import { WORLD } from './game.js';

const VIEW = { width: 1440, height: 900 };
const SQUASH = 0.82;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function ellipse(ctx, x, y, rx, ry, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function polygon(ctx, points, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
}

/** Rendering and its random numbers never touch the simulation. */
export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('This browser cannot create a 2D canvas.');
    this.ground = this.makeGround();
    this.reset();
    this.resize();
  }

  reset() {
    this.camera = { x: WORLD.width / 2, y: WORLD.height / 2 };
    this.kick = { x: 0, y: 0 };
    this.particles = [];
    this.corpses = [];
    this.casings = [];
    this.flashes = new Map();
    this.recoil = 0;
    this.shake = 0;
    this.fxTime = 0;
    this.randomState = 72319;
    this.foxFall = 0;
  }

  random() {
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  resize() {
    const width = Math.max(1, this.canvas.getBoundingClientRect().width);
    const density = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * density);
    this.canvas.height = Math.round(width * VIEW.height / VIEW.width * density);
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    // Shake and recoil are deliberately absent from the aiming transform.
    return {
      x: (clientX - rect.left) / rect.width * VIEW.width - VIEW.width / 2 + this.camera.x,
      y: ((clientY - rect.top) / rect.height * VIEW.height - VIEW.height / 2) / SQUASH + this.camera.y
    };
  }

  makeGround() {
    const canvas = document.createElement('canvas');
    canvas.width = WORLD.width + 100;
    canvas.height = WORLD.height + 100;
    const ctx = canvas.getContext('2d');
    ctx.translate(50, 50);
    ctx.fillStyle = '#1c2d25';
    ctx.fillRect(-50, -50, canvas.width, canvas.height);
    ctx.fillStyle = '#3b4b36';
    ctx.beginPath();
    ctx.roundRect(-13, -13, WORLD.width + 26, WORLD.height + 26, 20);
    ctx.fill();
    ctx.fillStyle = '#344a38';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // A fixed, quiet floor texture: no image files or runtime noise required.
    let noise = 87;
    const random = () => ((noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 42; i++) {
      ellipse(ctx, random() * WORLD.width, random() * WORLD.height, 20 + random() * 70, 15 + random() * 40, i % 2 ? '#394d39' : '#304633');
    }
    ctx.strokeStyle = '#65745924';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.width; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke(); }
    for (let y = 0; y <= WORLD.height; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke(); }
    for (let i = 0; i < 300; i++) {
      const x = 25 + random() * (WORLD.width - 50);
      const y = 25 + random() * (WORLD.height - 50);
      ctx.fillStyle = i % 4 ? '#50604688' : '#7a775099';
      ctx.fillRect(x, y, 2 + random() * 3, 2);
    }
    ctx.strokeStyle = '#86917255';
    ctx.setLineDash([5, 12]);
    ctx.strokeRect(25, 25, WORLD.width - 50, WORLD.height - 50);
    ctx.setLineDash([]);
    for (let x = 0; x <= WORLD.width; x += 80) {
      for (const y of [-8, WORLD.height + 8]) {
        ctx.fillStyle = '#13281a99'; ctx.fillRect(x - 3, y + 2, 12, 9);
        ctx.fillStyle = '#6f7555'; ctx.fillRect(x - 3, y - 5, 6, 10);
      }
    }
    for (let y = 80; y < WORLD.height; y += 80) {
      for (const x of [-8, WORLD.width + 8]) {
        ctx.fillStyle = '#13281a99'; ctx.fillRect(x - 3, y + 2, 12, 9);
        ctx.fillStyle = '#6f7555'; ctx.fillRect(x - 3, y - 5, 6, 10);
      }
    }
    ctx.fillStyle = '#b4c19755';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('NORTH COPSE  /  01', 44, 58);
    ctx.textAlign = 'right';
    ctx.fillText('KEEP MOVING', WORLD.width - 44, WORLD.height - 45);
    return canvas;
  }

  particle(particle) {
    if (this.particles.length >= 650) this.particles.shift();
    this.particles.push({ vx: 0, vy: 0, size: 3, colour: '#f5d696', ...particle, maxLife: particle.life });
  }

  sparks(event, count) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * TAU;
      const speed = 40 + this.random() * 150;
      this.particle({ kind: 'spark', effect: 'impacts', x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .16 + this.random() * .25, size: 1.5 + this.random() * 3, colour: i % 3 ? '#f4c476' : '#fbf1c1' });
    }
  }

  consume(events, settings) {
    for (const event of events) {
      if (event.type === 'shot') {
        const player = event.owner === 'player';
        if (player) {
          this.recoil = 17;
          this.casings.push({ x: event.x - Math.cos(event.angle) * 17 + (this.random() - .5) * 24, y: event.y + 12 + this.random() * 23, angle: this.random() * TAU });
          if (this.casings.length > 600) this.casings.shift();
          if (settings.cameraKick) { this.kick.x -= Math.cos(event.angle) * 3; this.kick.y -= Math.sin(event.angle) * 3; }
        }
        if (settings.muzzleFlash) this.particle({
          kind: 'muzzle', effect: 'muzzleFlash', x: event.x, y: event.y,
          life: .13, size: player ? 44 : 30, angle: event.angle,
          colour: player ? '#ffb347' : '#ff9a66'
        });
        if (settings.shake && player) this.shake = Math.max(this.shake, 2.5);
      }
      if (event.type === 'hit') {
        this.flashes.set(event.target === 'player' ? 'player' : event.id, .11);
        if (settings.impacts) this.sparks(event, event.lethal ? 14 : 8);
        if (settings.shake) this.shake = Math.max(this.shake, event.target === 'player' ? 7 : 4);
      }
      if (event.type === 'impact' && settings.impacts) this.sparks(event, 5);
      if (event.type === 'death') {
        this.corpses.push({ ...event, angle: event.angle + .5 });
        if (this.corpses.length > 100) this.corpses.shift();
        if (settings.bursts) this.particle({ kind: 'ring', effect: 'bursts', x: event.x, y: event.y, life: .32, size: 75 });
        if (settings.smoke) {
          for (let i = 0; i < 5; i++) this.particle({ kind: 'smoke', effect: 'smoke', x: event.x + (this.random() - .5) * 18, y: event.y, vx: (this.random() - .5) * 22, vy: -15 - this.random() * 15, life: 1.1 + this.random() * 1.2, size: 9 + this.random() * 9, colour: '#bac0a6' });
        }
      }
      if (event.type === 'gameover') {
        if (settings.impacts) this.sparks(event, 20);
        if (settings.shake) this.shake = 9;
      }
    }
    this.kick.x = clamp(this.kick.x, -16, 16);
    this.kick.y = clamp(this.kick.y, -16, 16);
  }

  update(game, input, settings, dt) {
    this.fxTime += dt;
    this.recoil *= Math.exp(-14 * dt);
    this.shake *= Math.exp(-15 * dt);
    this.kick.x *= Math.exp(-14 * dt);
    this.kick.y *= Math.exp(-14 * dt);
    const angle = game.player.angle;
    let x = WORLD.width / 2;
    let y = WORLD.height / 2;
    if (settings.cameraEase) { x += (game.player.x - x) * .065; y += (game.player.y - y) * .065; }
    if (settings.cameraLead) { x += Math.cos(angle) * 23; y += Math.sin(angle) * 20; }
    const ease = 1 - Math.exp(-8 * dt);
    if (!settings.cameraEase && !settings.cameraLead) { this.camera.x = x; this.camera.y = y; }
    else { this.camera.x += (x - this.camera.x) * ease; this.camera.y += (y - this.camera.y) * ease; }
    for (const [id, life] of this.flashes) life > dt ? this.flashes.set(id, life - dt) : this.flashes.delete(id);
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.kind === 'spark') { particle.vx *= Math.exp(-6 * dt); particle.vy *= Math.exp(-6 * dt); }
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
    if (game.phase === 'over') this.foxFall = Math.min(1, this.foxFall + dt * 3);
  }

  draw(game, input, settings) {
    const ctx = this.ctx;
    ctx.setTransform(this.canvas.width / VIEW.width, 0, 0, this.canvas.height / VIEW.height, 0, 0);
    ctx.fillStyle = '#1c2d25';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Deterministic oscillation makes a paused frame stable and avoids input jitter.
    const shakeX = settings.shake ? Math.sin(this.fxTime * 157) * this.shake : 0;
    const shakeY = settings.shake ? Math.cos(this.fxTime * 193) * this.shake : 0;
    ctx.translate(VIEW.width / 2 - this.camera.x + shakeX + (settings.cameraKick ? this.kick.x : 0), VIEW.height / 2 - this.camera.y * SQUASH + shakeY + (settings.cameraKick ? this.kick.y : 0));
    ctx.scale(1, SQUASH);
    ctx.drawImage(this.ground, -50, -50);

    if (settings.remains) for (const corpse of this.corpses) {
      ctx.save(); ctx.translate(corpse.x, corpse.y); ctx.rotate(corpse.angle);
      ellipse(ctx, 0, 0, corpse.kind === 'hound' ? 23 : 18, 11, '#202e24aa');
      ctx.fillStyle = corpse.kind === 'hound' ? '#89775870' : '#90947360';
      ctx.fillRect(-9, -6, 20, 11); ctx.restore();
    }
    if (settings.casings) for (const casing of this.casings) {
      ctx.save(); ctx.translate(casing.x, casing.y); ctx.rotate(casing.angle);
      ctx.fillStyle = '#17261c88'; ctx.fillRect(-2, -1, 7, 4);
      ctx.fillStyle = '#bb9b57'; ctx.fillRect(-3, -2, 6, 2); ctx.restore();
    }

    for (const enemy of game.enemies) {
      if (enemy.kind === 'hunter' && enemy.telegraph > 0) {
        ctx.strokeStyle = '#e2a37a80'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.x + Math.cos(enemy.angle) * 140, enemy.y + Math.sin(enemy.angle) * 140); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    const actors = [...game.enemies, { ...game.player, kind: 'fox', id: 'player' }].sort((a, b) => a.y - b.y);
    for (const actor of actors) this.actor(actor, game, settings);
    for (const bullet of game.bullets) this.bullet(bullet, settings);
    for (const particle of this.particles) if (settings[particle.effect]) this.drawParticle(particle);

    const target = input.manualAim ? null : game.enemies.find(enemy => enemy.id === input.targetId);
    if (game.phase === 'playing' && (input.manualAim || target)) {
      ctx.save(); ctx.translate(target ? target.x : input.aimX, target ? target.y : input.aimY); ctx.scale(1, 1 / SQUASH);
      const radius = target ? target.radius + 7 : 6;
      ctx.strokeStyle = target ? '#f6bd7590' : '#f7ebcbaf'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { ctx.moveTo(Math.cos(angle) * (radius + 3), Math.sin(angle) * (radius + 3)); ctx.lineTo(Math.cos(angle) * (radius + 7), Math.sin(angle) * (radius + 7)); }
      ctx.stroke(); ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  actor(actor, game, settings) {
    const ctx = this.ctx;
    const fox = actor.kind === 'fox';
    const moving = Math.hypot(actor.vx, actor.vy) > 5;
    const stride = settings.animation && moving ? Math.sin(game.time * 17 + (typeof actor.id === 'number' ? actor.id : 0)) : 0;
    const flash = settings.hitFlash && this.flashes.has(actor.id);
    const white = '#fff5d6';
    ctx.save(); ctx.translate(actor.x, actor.y);
    ellipse(ctx, 3, 7, fox ? 22 : 21, 14, '#11231866');
    if (fox && game.phase === 'over') ctx.rotate(this.foxFall * .9);
    ctx.translate(0, stride * .8);
    ctx.rotate(actor.angle);

    if (fox) {
      ctx.save(); ctx.translate(-10, 0); ctx.rotate(settings.animation ? stride * .12 : 0);
      polygon(ctx, [[0, -6], [-23, -12], [-39, 0], [-23, 11], [0, 6]], flash ? white : '#c66639');
      polygon(ctx, [[-26, -9], [-39, 0], [-26, 9], [-20, 0]], '#f0deba'); ctx.restore();
      ellipse(ctx, -4 + stride * 3, -11, 8, 5, '#292d26');
      ellipse(ctx, -4 - stride * 3, 11, 8, 5, '#292d26');
      ellipse(ctx, -3, 0, 17, 13, flash ? white : '#e38a48');
      ellipse(ctx, 5, 0, 12, 11, flash ? white : '#f2a45a');
      polygon(ctx, [[-1, -5], [-5, -17], [9, -10]], flash ? white : '#f4a259');
      polygon(ctx, [[-1, 5], [-5, 17], [9, 10]], flash ? white : '#f4a259');
      polygon(ctx, [[-1, -8], [-3, -13], [5, -9]], '#673f31');
      polygon(ctx, [[-1, 8], [-3, 13], [5, 9]], '#673f31');
      polygon(ctx, [[5, -8], [23, 0], [5, 8], [10, 0]], '#f7e5bf');
      ellipse(ctx, 21, 0, 3, 3, '#282f27');
      ellipse(ctx, 8, -5, 1.8, 2, '#262c25'); ellipse(ctx, 8, 5, 1.8, 2, '#262c25');
      this.gun(settings.gunRecoil ? this.recoil : 0, flash, actor.radius + 9);
    } else if (actor.kind === 'hunter') {
      ellipse(ctx, -5 + stride * 3, -11, 9, 5, '#292e27'); ellipse(ctx, -5 - stride * 3, 11, 9, 5, '#292e27');
      ellipse(ctx, -4, 0, 18, 14, flash ? white : '#718164');
      ctx.fillStyle = flash ? white : '#aa8661'; ctx.fillRect(-4, 5, 15, 7);
      ellipse(ctx, 10, 0, 9, 10, flash ? white : '#d3b187');
      ellipse(ctx, 3, 0, 12, 16, flash ? white : '#405947');
      ellipse(ctx, 0, 0, 11, 11, flash ? white : '#78916a');
      ctx.fillStyle = '#d1bc7c'; ctx.fillRect(0, -10, 3, 20);
      this.gun(0, flash, actor.radius + 9);
    } else {
      ellipse(ctx, -8 + stride * 3, -8, 7, 4, '#443b2d'); ellipse(ctx, 8 - stride * 3, 9, 7, 4, '#443b2d');
      polygon(ctx, [[-12, -3], [-30, -7 - stride * 2], [-24, 1], [-12, 5]], flash ? white : '#ac8f65');
      ellipse(ctx, -3, 0, 20, 11, flash ? white : '#b5986d');
      ellipse(ctx, -7, -1, 11, 8, flash ? white : '#665844');
      ellipse(ctx, 12, 0, 11, 10, flash ? white : '#c9ad80');
      ellipse(ctx, 11, -9, 8, 4, '#766044'); ellipse(ctx, 11, 9, 8, 4, '#766044');
      ellipse(ctx, 23, 0, 8, 6, flash ? white : '#dac5a0');
      ellipse(ctx, 29, 0, 3, 4, '#342f26');
      ellipse(ctx, 16, -5, 1.7, 1.7, '#262d24'); ellipse(ctx, 16, 5, 1.7, 1.7, '#262d24');
      ctx.fillStyle = '#c37558'; ctx.fillRect(1, -11, 3, 22);
    }
    ctx.restore();
    if (fox) {
      ctx.strokeStyle = game.player.invulnerable > 0 ? '#efb980' : '#e4af655a';
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(actor.x, actor.y + 1, 29, 26, 0, 0, TAU); ctx.stroke();
    } else if (actor.hp < actor.maxHp && !settings.lowHp) {
      ctx.fillStyle = '#1d2b21'; ctx.fillRect(actor.x - 15, actor.y - 31, 30, 3);
      ctx.fillStyle = '#d0a97a'; ctx.fillRect(actor.x - 15, actor.y - 31, 30 * actor.hp / actor.maxHp, 3);
    }
  }

  gun(recoil, flash, muzzle) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(muzzle - recoil, 0); ctx.scale(1.8, 1.8); ctx.translate(-muzzle, 0);
    // Grow back from the muzzle so the resting barrel tip still matches shot origins.
    polygon(ctx, [[4, 8], [11, 3], [18, -3], [muzzle, -3], [muzzle, 3], [20, 3], [12, 12], [4, 13]], flash ? '#fff5d6' : '#536361');
    ctx.strokeStyle = '#18231f'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#b0916c'; ctx.fillRect(5, 8, 9, 5);
    ctx.fillStyle = '#9da69b'; ctx.fillRect(18, -2, muzzle - 18, 4);
    ctx.fillStyle = '#202b24'; ctx.fillRect(muzzle - 2, -3, 2, 6);
    ctx.restore();
  }

  bullet(bullet, settings) {
    const ctx = this.ctx;
    const player = bullet.owner === 'player';
    ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
    if (settings.bigBullets) {
      ctx.scale(1.4, 1.4);
      ctx.fillStyle = player ? '#f1c27945' : '#e3976d55'; ctx.fillRect(-24, -3, 27, 6);
      ellipse(ctx, 0, 0, player ? 9 : 7, player ? 4.5 : 5, player ? '#ffe6a3' : '#f4b28c');
      ellipse(ctx, 2, 0, 4, 2.2, '#fff6d2');
    } else {
      ctx.fillStyle = player ? '#fce7b2' : '#f4aa86'; ctx.fillRect(-5, -2.5, 10, 5);
    }
    ctx.restore();
  }

  drawParticle(particle) {
    const ctx = this.ctx;
    const progress = 1 - particle.life / particle.maxLife;
    ctx.save(); ctx.translate(particle.x, particle.y);
    if (particle.kind === 'spark') {
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = particle.colour; ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    } else if (particle.kind === 'smoke') {
      ctx.globalAlpha = (1 - progress) * .22;
      ellipse(ctx, 0, 0, particle.size * (1 + progress * 1.6), particle.size * (1 + progress), particle.colour);
    } else if (particle.kind === 'ring') {
      const radius = 8 + Math.sin(progress * Math.PI / 2) * particle.size;
      ctx.globalAlpha = (1 - progress) * .65;
      ctx.lineWidth = Math.max(1, 8 * (1 - progress)); ctx.strokeStyle = '#ffe3aa';
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
      ellipse(ctx, 0, 0, radius * .62, radius * .62, '#e9a45a35');
    } else if (particle.kind === 'muzzle') {
      ctx.rotate(particle.angle);
      // Hold the bright peak before fading, so the flash reads at laptop scale.
      ctx.globalAlpha = 1 - progress ** 3;
      const size = particle.size * (1 - progress * .25);
      const glow = ctx.createRadialGradient(size * .15, 0, 0, size * .15, 0, size);
      glow.addColorStop(0, '#ffe9a480');
      glow.addColorStop(.35, '#ffb34740');
      glow.addColorStop(1, '#ffb34700');
      ctx.globalCompositeOperation = 'lighter';
      ellipse(ctx, size * .15, 0, size, size * .8, glow);
      ctx.globalCompositeOperation = 'source-over';
      polygon(ctx, [
        [-5, 0], [size * .12, -size * .5], [size * .28, -size * .18],
        [size * .72, -size * .3], [size * .52, -size * .09], [size, 0],
        [size * .52, size * .09], [size * .72, size * .3],
        [size * .28, size * .18], [size * .12, size * .5]
      ], particle.colour);
      polygon(ctx, [[-3, 0], [size * .18, -size * .25], [size * .78, 0], [size * .18, size * .25]], '#ffe9a1');
      polygon(ctx, [[-3, 0], [size * .16, -size * .13], [size * .58, 0], [size * .16, size * .13]], '#fffdf1');
    }
    ctx.restore();
  }
}
