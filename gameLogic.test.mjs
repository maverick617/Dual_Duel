import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_HEALTH,
  applyAttack,
  healPlayer,
  tryCollectPickup,
  withinAttackRange,
} from "../src/gameLogic.js";

test("attack reduces blood by 1 and never below 0", () => {
  assert.equal(applyAttack(10, 1), 9);
  assert.equal(applyAttack(1, 1), 0);
  assert.equal(applyAttack(0, 3), 0);
});

test("heal restores blood but caps at max health", () => {
  assert.equal(healPlayer(8, 1), 9);
  assert.equal(healPlayer(10, 1), MAX_HEALTH);
  assert.equal(healPlayer(9, 3), MAX_HEALTH);
});

test("pickup collision requires players close enough", () => {
  const player = { x: 10, y: 10 };
  const pickupNear = { x: 20, y: 16 };
  const pickupFar = { x: 80, y: 80 };

  assert.equal(tryCollectPickup(player, pickupNear, 20), true);
  assert.equal(tryCollectPickup(player, pickupFar, 20), false);
});

test("attack range checks distance and facing direction", () => {
  const attacker = { x: 100, y: 100, facing: { x: 1, y: 0 } };
  const inFront = { x: 140, y: 105 };
  const behind = { x: 70, y: 100 };

  assert.equal(withinAttackRange(attacker, inFront, 64), true);
  assert.equal(withinAttackRange(attacker, behind, 64), false);
});
