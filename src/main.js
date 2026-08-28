import { createGame, stepGame, FIXED_STEP, WORLD } from './game.js';
import { GameRenderer } from './render.js';
import { GameAudio } from './audio.js';
import { EFFECTS, GROUPS, MOTION_EFFECTS, preset, presetName, referenceTime } from './settings.js';

const byId = id => document.getElementById(id);
const canvas = byId('game');
const renderer = new GameRenderer(canvas);
const audio = new GameAudio();
const SEED = 1337;
let game = createGame(SEED);
let settings = preset('bare');
let mode = 'ready';
let demo = false;
let accumulator = 0;
let hitPause = 0;
let endingTime = 0;
let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastTime = performance.now();
let statsClock = 0;
let fpsTime = 0;
let fpsFrames = 0;
const keys = new Set();
const pointer = { down: false, tap: false, known: false, x: 0, y: 0 };
const input = { moveX: 0, moveY: 0, aimX: game.player.x + 160, aimY: game.player.y, shoot: false };
const checkboxes = new Map();

for (const group of GROUPS) {
  const section = document.createElement('details');
  section.className = 'effect-group';
  section.open = group.id === 'feedback';
  const summary = document.createElement('summary');
  const name = document.createElement('span');
  name.textContent = group.name;
  const count = document.createElement('span');
  count.className = 'group-count';
  count.id = `count-${group.id}`;
  summary.append(name, count);
  const note = document.createElement('p');
  note.className = 'group-note';
  note.textContent = group.note;
  const list = document.createElement('ul');
  list.className = 'effect-list';
  for (const effect of EFFECTS.filter(effect => effect.group === group.id)) {
    const row = document.createElement('li');
    row.className = 'effect-row';
    const label = document.createElement('label');
    label.title = effect.description;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `effect-${effect.id}`;
    checkbox.setAttribute('aria-describedby', `description-${effect.id}`);
    const title = document.createElement('span');
    title.textContent = effect.name;
    label.append(checkbox, title);
    const description = document.createElement('span');
    description.className = 'sr-only';
    description.id = `description-${effect.id}`;
    description.textContent = effect.description;
    const reference = document.createElement('a');
    reference.href = referenceTime(effect.time);
    reference.target = '_blank';
    reference.rel = 'noreferrer';
    reference.textContent = effect.time;
    reference.setAttribute('aria-label', `${effect.name} in the reference video at ${effect.time}`);
    checkbox.addEventListener('change', () => {
      settings[effect.id] = checkbox.checked;
      applySettings();
      if (effect.id === 'sound' && checkbox.checked) unlockAudio();
    });
    checkboxes.set(effect.id, checkbox);
    row.append(label, description, reference);
    list.append(row);
  }
  section.append(summary, note, list);
  byId('effect-groups').append(section);
}

function announce(text) { byId('announcement').textContent = text; }

function updateAudioStatus() {
  byId('audio-status').textContent = !settings.sound ? 'Sound is off'
    : audio.state === 'unavailable' ? 'Audio unavailable in this browser'
    : mode === 'paused' ? 'Sound paused'
    : audio.state === 'running' ? 'Sound ready'
    : 'Press Start or click the arena to enable sound';
}

function unlockAudio() {
  audio.setEnabled(settings.sound && mode !== 'paused');
  if (settings.sound) void audio.unlock().then(updateAudioStatus);
}

function applySettings() {
  if (reducedMotion) for (const id of MOTION_EFFECTS) settings[id] = false;
  if (!settings.hitStop) hitPause = 0;
  for (const effect of EFFECTS) {
    const checkbox = checkboxes.get(effect.id);
    checkbox.checked = settings[effect.id];
    checkbox.disabled = reducedMotion && MOTION_EFFECTS.includes(effect.id);
  }
  const selected = presetName(settings, reducedMotion);
  for (const button of document.querySelectorAll('[data-preset]')) button.setAttribute('aria-pressed', String(button.dataset.preset === selected));
  byId('mode-label').textContent = selected.toUpperCase();
  byId('effect-count').textContent = `${EFFECTS.filter(({ id }) => settings[id]).length} / ${EFFECTS.length}`;
  byId('preset-note').textContent = {
    bare: 'All optional effects off. The full game still works.',
    juiced: 'Presentation only. Damage, speed and enemy numbers stay the same.',
    overdrive: 'Presentation + combat changes. Expect a much busier clearing.',
    custom: 'Your own mix. Open Combat & timing to check for rule changes.'
  }[selected];
  for (const group of GROUPS) {
    const effects = EFFECTS.filter(effect => effect.group === group.id);
    byId(`count-${group.id}`).textContent = `${effects.filter(({ id }) => settings[id]).length}/${effects.length}`;
  }
  audio.setEnabled(settings.sound && mode !== 'paused');
  updateAudioStatus();
}

for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', () => {
    settings = preset(button.dataset.preset, reducedMotion);
    applySettings();
    unlockAudio();
    announce(`${button.dataset.preset} preset selected. ${byId('preset-note').textContent}`);
  });
}

byId('reduced-motion').checked = reducedMotion;
byId('reduced-motion').addEventListener('change', event => {
  reducedMotion = event.target.checked;
  applySettings();
  announce(reducedMotion ? 'Camera movement and character animation disabled.' : 'Camera and animation switches are available again.');
});
byId('volume').addEventListener('input', event => {
  const value = Number(event.target.value);
  byId('volume-value').textContent = `${value}%`;
  audio.setVolume(value / 100);
});

function clearInput() {
  keys.clear();
  pointer.down = false;
  pointer.tap = false;
  input.shoot = false;
}

function setMode(next) {
  mode = next;
  byId('stage').dataset.mode = mode;
  byId('overlay').hidden = mode === 'playing' || mode === 'ending';
  byId('pause').disabled = !['playing', 'paused'].includes(mode);
  byId('pause').innerHTML = mode === 'paused' ? 'Resume <kbd>P</kbd>' : 'Pause <kbd>P</kbd>';
  if (mode === 'paused') {
    byId('overlay-eyebrow').textContent = 'TAKE A BREATHER';
    byId('overlay-title').textContent = 'Paused.';
    byId('overlay-description').textContent = 'Change a switch. Compare the frame. Then get back out there.';
    byId('start').textContent = 'Resume →';
    byId('overlay-hint').textContent = 'Press P or Escape to resume.';
    audio.setEnabled(false);
    announce('Game paused.');
  } else if (mode === 'over') {
    byId('overlay-eyebrow').textContent = 'THE HUNT IS OVER';
    byId('overlay-title').textContent = 'Outfoxed.';
    byId('overlay-description').textContent = `${game.kills} takedown${game.kills === 1 ? '' : 's'}. ${formatTime(game.time)} in the clearing.`;
    byId('start').textContent = demo ? 'Run the demo again →' : 'Try again →';
    byId('overlay-hint').textContent = 'Same seed, fresh start. Try a different mix.';
    announce(`Game over. ${game.kills} takedowns in ${formatTime(game.time)}.`);
  } else if (mode === 'playing') {
    audio.setEnabled(settings.sound);
    announce(demo ? 'Demo running. You can change effects while it plays.' : 'Game started.');
  }
  updateAudioStatus();
}

function startRun() {
  clearInput();
  audio.stop();
  game = createGame(SEED);
  renderer.reset();
  accumulator = 0;
  hitPause = 0;
  endingTime = 0;
  input.aimX = game.player.x + 160;
  input.aimY = game.player.y;
  setMode('playing');
  unlockAudio();
  updateStats();
  canvas.focus({ preventScroll: true });
}

function togglePause() {
  if (mode === 'playing') {
    clearInput();
    accumulator = 0;
    setMode('paused');
  } else if (mode === 'paused') {
    setMode('playing');
    unlockAudio();
    canvas.focus({ preventScroll: true });
  }
}

byId('start').addEventListener('click', () => mode === 'paused' ? togglePause() : startRun());
byId('restart').addEventListener('click', startRun);
byId('pause').addEventListener('click', togglePause);
byId('demo').addEventListener('click', () => {
  demo = !demo;
  byId('demo').setAttribute('aria-pressed', String(demo));
  if (demo) startRun();
  else { clearInput(); canvas.focus({ preventScroll: true }); announce('Demo off. You control the fox.'); }
});

canvas.addEventListener('pointermove', event => {
  pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true;
});
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || mode !== 'playing') return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true;
  pointer.down = true; pointer.tap = true;
  unlockAudio();
});
window.addEventListener('pointerup', () => { pointer.down = false; });
canvas.addEventListener('pointercancel', clearInput);
canvas.addEventListener('lostpointercapture', () => { pointer.down = false; });
canvas.addEventListener('contextmenu', event => event.preventDefault());

const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'];
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest('textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="range"])')) return;
  if (event.code === 'KeyP' || event.code === 'Escape') {
    event.preventDefault();
    if (!event.repeat) togglePause();
  } else if (event.code === 'KeyR') {
    event.preventDefault();
    if (!event.repeat) startRun();
  } else if (movementKeys.includes(event.code) && mode === 'playing' && !event.target.closest('input, button, summary, a, select')) {
    event.preventDefault();
    keys.add(event.code);
  }
});
document.addEventListener('keyup', event => keys.delete(event.code));
canvas.addEventListener('blur', clearInput);
window.addEventListener('blur', () => { clearInput(); if (mode === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') togglePause(); });
new ResizeObserver(() => renderer.resize()).observe(canvas);

function readInput() {
  if (demo) {
    const targetX = WORLD.width / 2 + Math.cos(game.time * .46) * 270;
    const targetY = WORLD.height / 2 + Math.sin(game.time * .46) * 180;
    const distance = Math.hypot(targetX - game.player.x, targetY - game.player.y);
    input.moveX = distance > 7 ? (targetX - game.player.x) / Math.max(1, distance) : 0;
    input.moveY = distance > 7 ? (targetY - game.player.y) / Math.max(1, distance) : 0;
    let closest = null;
    let nearest = Infinity;
    for (const enemy of game.enemies) {
      const range = Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y);
      if (range < nearest) { closest = enemy; nearest = range; }
    }
    if (closest) {
      const lead = nearest / (settings.fastBullets ? 1100 : 620) * .7;
      input.aimX = closest.x + closest.vx * lead;
      input.aimY = closest.y + closest.vy * lead;
    }
    input.shoot = Boolean(closest);
  } else {
    input.moveX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    input.moveY = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    if (pointer.known) {
      const point = renderer.screenToWorld(pointer.x, pointer.y);
      input.aimX = point.x; input.aimY = point.y;
    }
    input.shoot = pointer.down || pointer.tap || keys.has('Space');
  }
}

function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }

function updateStats() {
  byId('health').textContent = Array.from({ length: game.player.maxHp }, (_, index) => index < game.player.hp ? '●' : '○').join(' ');
  byId('health').setAttribute('aria-label', `${game.player.hp} of ${game.player.maxHp} health`);
  byId('kills').textContent = String(game.kills).padStart(2, '0');
  byId('time').textContent = formatTime(game.time);
  byId('shots').textContent = String(game.shots);
  byId('enemy-count').textContent = `${game.enemies.length} ${game.enemies.length === 1 ? 'enemy' : 'enemies'}`;
}

function frame(now) {
  const elapsed = Math.max(0, (now - lastTime) / 1000);
  const dt = Math.min(.05, elapsed);
  lastTime = now;
  if (mode === 'playing') {
    const available = Math.max(0, dt - hitPause);
    hitPause = Math.max(0, hitPause - dt);
    accumulator += available;
    while (accumulator >= FIXED_STEP && mode === 'playing') {
      readInput();
      const events = stepGame(game, input, settings, FIXED_STEP);
      pointer.tap = false;
      renderer.consume(events, settings);
      audio.play(events, settings);
      accumulator -= FIXED_STEP;
      if (game.phase === 'over') { endingTime = 0; setMode(settings.deathSlowMotion ? 'ending' : 'over'); accumulator = 0; }
      if (settings.hitStop && events.some(event => event.type === 'hit')) {
        hitPause = events.some(event => event.type === 'death') ? .045 : .025;
        accumulator = 0;
        break;
      }
    }
  } else if (mode === 'ending') {
    endingTime += dt;
    if (endingTime >= 1.1) setMode('over');
  }
  const visualDt = ['ready', 'paused'].includes(mode) ? 0 : dt * (mode === 'ending' ? .23 : 1);
  renderer.update(game, input, settings, visualDt);
  renderer.draw(game, input, settings);
  statsClock += dt;
  fpsTime += elapsed; fpsFrames++;
  if (statsClock >= .1) { updateStats(); statsClock = 0; }
  if (fpsTime >= .75) { byId('fps').textContent = `${Math.round(fpsFrames / fpsTime)} FPS`; fpsTime = 0; fpsFrames = 0; }
  requestAnimationFrame(frame);
}

applySettings();
setMode('ready');
updateStats();
requestAnimationFrame(frame);
