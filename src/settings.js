// Times refer to the spoken introductions in The Art of Screenshake.
export const REFERENCE_URL = 'https://www.youtube.com/watch?v=AJdEqssNZ-U';

export const EFFECTS = [
  { id: 'animation', name: 'Character animation', group: 'feedback', time: '8:25', description: 'A running bob, moving feet and a swishing fox tail.' },
  { id: 'sound', name: 'Sound effects', group: 'feedback', time: '8:25', description: 'Synthesised shots, impacts and defeat sounds.' },
  { id: 'bigBullets', name: 'Bigger bullets', group: 'feedback', time: '10:10', description: 'Make shots easier to see. Collision size stays the same.' },
  { id: 'muzzleFlash', name: 'Muzzle flash', group: 'feedback', time: '10:36', description: 'A short flash at the end of the barrel.' },
  { id: 'impacts', name: 'Impact particles', group: 'feedback', time: '11:43', description: 'Sparks mark where a shot meets an enemy or the arena edge.' },
  { id: 'hitFlash', name: 'Hit flash', group: 'feedback', time: '12:06', description: 'Briefly highlight the character that took damage.' },
  { id: 'gunRecoil', name: 'Gun recoil animation', group: 'feedback', time: '19:54', description: 'The weapon kicks back, without moving the fox.' },
  { id: 'bass', name: 'Bassier shots', group: 'feedback', time: '21:35', description: 'Add a low thump to gunshots. Requires Sound effects.' },
  { id: 'cameraEase', name: 'Camera follow', group: 'camera', time: '14:42', description: 'The camera gently eases towards the fox.' },
  { id: 'cameraLead', name: 'Look ahead', group: 'camera', time: '15:14', description: 'Frame a little more of the direction you are aiming.' },
  { id: 'shake', name: 'Screen shake', group: 'camera', time: '16:30', description: 'Small, decaying jolts when firing or landing a hit.' },
  { id: 'cameraKick', name: 'Directional camera kick', group: 'camera', time: '25:21', description: 'Recoil opposite the shot, separate from random shake.' },
  { id: 'remains', name: 'Fallen enemies', group: 'aftermath', time: '13:07', description: 'Leave subdued silhouettes where enemies fell.' },
  { id: 'casings', name: 'Shell casings', group: 'aftermath', time: '20:31', description: 'Spent cartridges stay on the ground; oldest removed at the cap.' },
  { id: 'bursts', name: 'Death bursts', group: 'aftermath', time: '27:20', description: 'A stylised, non-damaging burst when an enemy falls.' },
  { id: 'smoke', name: 'Lingering smoke', group: 'aftermath', time: '27:49', description: 'Smoke briefly marks the end of a fight.' },
  { id: 'lowHp', name: 'One-hit enemies', group: 'combat', time: '9:00', description: 'Enemies fall to one hit. Changes difficulty.' },
  { id: 'rapidFire', name: 'Rapid fire', group: 'combat', time: '9:25', description: 'Increase the firing rate. Changes weapon strength.' },
  { id: 'fastBullets', name: 'Faster bullets', group: 'combat', time: '10:56', description: 'Shots reach their target sooner.' },
  { id: 'spread', name: 'Shot spread', group: 'combat', time: '11:13', description: 'A small, seeded variation in aim.' },
  { id: 'enemyKnockback', name: 'Enemy knockback', group: 'combat', time: '12:36', description: 'Hits physically push enemies away.' },
  { id: 'playerRecoil', name: 'Player kickback', group: 'combat', time: '17:08', description: 'Firing physically pushes the fox backwards.' },
  { id: 'hitStop', name: 'Hit pause', group: 'combat', time: '18:01', description: 'Pause simulation for 25–45 ms on a hit; input and rendering stay responsive.' },
  { id: 'tripleShot', name: 'Triple shot', group: 'combat', time: '23:05', description: 'Fire three projectiles at once.' },
  { id: 'fastEnemies', name: 'Faster enemies', group: 'combat', time: '23:59', description: 'Hunters and hounds close in faster.' },
  { id: 'moreEnemies', name: 'More enemies', group: 'combat', time: '24:37', description: 'New enemies arrive more often; the arena still has a hard cap.' },
  { id: 'deathSlowMotion', name: 'Slow-motion defeat', group: 'combat', time: '29:24', description: 'Slow the final visual aftermath before showing the result.' }
];

export const GROUPS = [
  { id: 'feedback', name: 'Feedback', note: 'See and hear each action.' },
  { id: 'camera', name: 'Camera', note: 'Change the framing, not the aim.' },
  { id: 'aftermath', name: 'Aftermath', note: 'Leave a trace of the fight.' },
  { id: 'combat', name: 'Combat & timing', note: 'These switches change how the game plays.' }
];

export const MOTION_EFFECTS = ['animation', 'cameraEase', 'cameraLead', 'shake', 'cameraKick'];

export function preset(name, reducedMotion = false) {
  const settings = Object.fromEntries(EFFECTS.map(effect => [effect.id,
    name === 'overdrive' || (name === 'juiced' && effect.group !== 'combat')
  ]));
  if (reducedMotion) for (const id of MOTION_EFFECTS) settings[id] = false;
  return settings;
}

export function presetName(settings, reducedMotion = false) {
  for (const name of ['bare', 'juiced', 'overdrive']) {
    const candidate = preset(name, reducedMotion);
    if (EFFECTS.every(({ id }) => Boolean(settings[id]) === candidate[id])) return name;
  }
  return 'custom';
}

export function referenceTime(time) {
  const [minutes, seconds] = time.split(':').map(Number);
  return `${REFERENCE_URL}&t=${minutes * 60 + seconds}s`;
}
