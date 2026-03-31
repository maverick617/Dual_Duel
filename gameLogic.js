export const MAX_HEALTH = 10;

export function clampHealth(value) {
  return Math.max(0, Math.min(MAX_HEALTH, value));
}

export function applyAttack(defenderHealth, damage = 1) {
  return clampHealth(defenderHealth - damage);
}

export function healPlayer(currentHealth, healAmount = 1) {
  return clampHealth(currentHealth + healAmount);
}

export function withinAttackRange(attacker, defender, range = 64) {
  const dx = defender.x - attacker.x;
  const dy = defender.y - attacker.y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) {
    return false;
  }

  const facing = attacker.facing || { x: 1, y: 0 };
  const dot = dx * facing.x + dy * facing.y;
  return dot >= -10;
}

export function tryCollectPickup(player, pickup, collectRadius = 24) {
  const distance = Math.hypot(player.x - pickup.x, player.y - pickup.y);
  return distance <= collectRadius;
}
