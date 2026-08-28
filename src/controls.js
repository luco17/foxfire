/** Demo targeting: pick the nearest living enemy, with stable ID ties. */
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

/** Player movement, aiming and firing come only from explicit input. */
export function getPlayerInput(game, controls = {}) {
  return {
    moveX: controls.moveX ?? 0,
    moveY: controls.moveY ?? 0,
    aimX: controls.pointerAim?.x ?? game.player.x + Math.cos(game.player.angle) * 160,
    aimY: controls.pointerAim?.y ?? game.player.y + Math.sin(game.player.angle) * 160,
    shoot: game.phase === 'playing' && controls.fire === true,
    targetId: null,
    manualAim: true,
  };
}
