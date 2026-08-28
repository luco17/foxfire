/** Pick the nearest living enemy; IDs make equal-distance ties stable. */
export function getAutoAim(game, settings = {}) {
  let target = null;
  let nearest = Infinity;
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    const distance = Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y);
    if (distance < nearest || (distance === nearest && target && enemy.id < target.id)) {
      target = enemy;
      nearest = distance;
    }
  }
  if (!target) return null;
  const lead = nearest / (settings.fastBullets === true ? 1100 : 620) * 0.7;
  return {
    aimX: target.x + target.vx * lead,
    aimY: target.y + target.vy * lead,
    targetId: target.id,
  };
}

/** Aim assistance never moves the fox or changes combat state. */
export function getPlayerInput(game, controls = {}, settings = {}) {
  const mode = controls.mode === 'mouse' ? 'mouse' : controls.mode === 'space' ? 'space' : 'auto';
  const manualAim = mode === 'mouse';
  const target = manualAim ? null : getAutoAim(game, settings);
  let aimX = game.player.x + Math.cos(game.player.angle) * 160;
  let aimY = game.player.y + Math.sin(game.player.angle) * 160;
  if (target) {
    aimX = target.aimX;
    aimY = target.aimY;
  } else if (manualAim && controls.pointerAim) {
    aimX = controls.pointerAim.x;
    aimY = controls.pointerAim.y;
  }
  return {
    moveX: controls.moveX ?? 0,
    moveY: controls.moveY ?? 0,
    aimX,
    aimY,
    shoot: game.phase === 'playing' && (mode === 'auto' ? target !== null : controls.fire === true),
    targetId: target?.targetId ?? null,
    manualAim,
  };
}
