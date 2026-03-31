import {
  MAX_HEALTH,
  applyAttack,
  healPlayer,
  tryCollectPickup,
  withinAttackRange,
} from "./gameLogic.js";

const ATTACK_COOLDOWN_MS = 380;
const CONTROL_STORAGE_KEY = "dual-duel-controls-v1";
const ACTIONS = ["up", "down", "left", "right", "attack"];

const DEFAULT_CONTROLS = {
  1: {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    attack: "KeyF",
  },
  2: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    attack: "KeyL",
  },
};

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

const p1HealthEl = document.getElementById("p1-health");
const p2HealthEl = document.getElementById("p2-health");
const p1CooldownEl = document.getElementById("p1-cooldown");
const p2CooldownEl = document.getElementById("p2-cooldown");
const p1CooldownFill = document.getElementById("p1-cooldown-fill");
const p2CooldownFill = document.getElementById("p2-cooldown-fill");
const p1ControlsSummary = document.getElementById("p1-controls-summary");
const p2ControlsSummary = document.getElementById("p2-controls-summary");
const controlConfigEl = document.getElementById("control-config");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart-btn");

const keysDown = new Set();
const arena = {
  width: canvas.width,
  height: canvas.height,
};
let pendingRebind = null;

const controlsConfig = loadControlConfig();

function clonePlayerControls(playerId) {
  return { ...controlsConfig[playerId] };
}

const baseState = () => ({
  isGameOver: false,
  winner: null,
  pickupSpawnTimer: 0,
  pickupSpawnEveryMs: 2800,
  players: [
    {
      id: 1,
      label: "Player 1",
      color: "#3abef9",
      x: 130,
      y: 260,
      radius: 18,
      speed: 3,
      attackCooldown: 0,
      facing: { x: 1, y: 0 },
      isMoving: false,
      walkTimer: 0,
      attackFlashTimer: 0,
      health: MAX_HEALTH,
      controls: clonePlayerControls(1),
    },
    {
      id: 2,
      label: "Player 2",
      color: "#ff7f7f",
      x: 770,
      y: 260,
      radius: 18,
      speed: 3,
      attackCooldown: 0,
      facing: { x: -1, y: 0 },
      isMoving: false,
      walkTimer: 0,
      attackFlashTimer: 0,
      health: MAX_HEALTH,
      controls: clonePlayerControls(2),
    },
  ],
  pickups: [],
});

let state = baseState();
let lastFrame = performance.now();

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnPickup() {
  if (state.pickups.length >= 6) return;
  state.pickups.push({
    x: randomBetween(35, arena.width - 35),
    y: randomBetween(35, arena.height - 35),
    radius: 10,
    healAmount: 1,
  });
}

function resetGame() {
  state = baseState();
  statusEl.textContent = "Fight!";
  updateHud();
}

function loadControlConfig() {
  try {
    const raw = localStorage.getItem(CONTROL_STORAGE_KEY);
    if (!raw) {
      return structuredClone(DEFAULT_CONTROLS);
    }
    const parsed = JSON.parse(raw);

    return {
      1: {
        ...DEFAULT_CONTROLS[1],
        ...(parsed[1] || parsed.player1 || {}),
      },
      2: {
        ...DEFAULT_CONTROLS[2],
        ...(parsed[2] || parsed.player2 || {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_CONTROLS);
  }
}

function saveControlConfig() {
  localStorage.setItem(CONTROL_STORAGE_KEY, JSON.stringify(controlsConfig));
}

function codeToLabel(code) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num${code.slice(6)}`;
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (code === "Space") return "Space";
  return code;
}

function controlSummary(controls) {
  return `Move: ${codeToLabel(controls.up)} ${codeToLabel(controls.left)} ${codeToLabel(
    controls.down,
  )} ${codeToLabel(controls.right)} · Attack: ${codeToLabel(controls.attack)}`;
}

function renderControlConfig() {
  controlConfigEl.innerHTML = "";

  state.players.forEach((player) => {
    const card = document.createElement("section");
    card.className = "control-card";
    card.innerHTML = `<h3>${player.label}</h3>`;

    const grid = document.createElement("div");
    grid.className = "control-grid";

    ACTIONS.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "keybind-btn";
      btn.dataset.playerId = String(player.id);
      btn.dataset.action = action;

      if (pendingRebind?.playerId === player.id && pendingRebind.action === action) {
        btn.classList.add("rebinding");
      }

      const currentCode = player.controls[action];
      btn.innerHTML = `<span>${action}</span>${
        pendingRebind?.playerId === player.id && pendingRebind.action === action
          ? "Press a key..."
          : codeToLabel(currentCode)
      }`;

      grid.appendChild(btn);
    });

    card.appendChild(grid);
    controlConfigEl.appendChild(card);
  });
}

function applyRebind(playerId, action, code) {
  controlsConfig[playerId][action] = code;
  const player = state.players.find((p) => p.id === playerId);
  if (player) {
    player.controls[action] = code;
  }
  saveControlConfig();
  statusEl.textContent = `Updated ${player?.label ?? "Player"} ${action} key to ${codeToLabel(code)}.`;
  updateHud();
}

function keepInBounds(player) {
  player.x = Math.max(player.radius, Math.min(arena.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(arena.height - player.radius, player.y));
}

function movePlayer(player) {
  let dx = 0;
  let dy = 0;

  if (keysDown.has(player.controls.up)) dy -= 1;
  if (keysDown.has(player.controls.down)) dy += 1;
  if (keysDown.has(player.controls.left)) dx -= 1;
  if (keysDown.has(player.controls.right)) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const mag = Math.hypot(dx, dy);
    dx /= mag;
    dy /= mag;
    player.x += dx * player.speed;
    player.y += dy * player.speed;
    player.facing = { x: dx, y: dy };
    player.isMoving = true;
  } else {
    player.isMoving = false;
  }

  keepInBounds(player);
}

function updateHud() {
  const [p1, p2] = state.players;
  p1HealthEl.textContent = `Blood: ${p1.health}/${MAX_HEALTH}`;
  p2HealthEl.textContent = `Blood: ${p2.health}/${MAX_HEALTH}`;

  const p1ReadyPct = Math.max(0, 1 - p1.attackCooldown / ATTACK_COOLDOWN_MS);
  const p2ReadyPct = Math.max(0, 1 - p2.attackCooldown / ATTACK_COOLDOWN_MS);
  p1CooldownFill.style.width = `${p1ReadyPct * 100}%`;
  p2CooldownFill.style.width = `${p2ReadyPct * 100}%`;

  p1CooldownEl.textContent = p1.attackCooldown > 0 ? `Cooldown: ${Math.ceil(p1.attackCooldown)}ms` : "Attack ready";
  p2CooldownEl.textContent = p2.attackCooldown > 0 ? `Cooldown: ${Math.ceil(p2.attackCooldown)}ms` : "Attack ready";

  p1ControlsSummary.textContent = controlSummary(p1.controls);
  p2ControlsSummary.textContent = controlSummary(p2.controls);
}

function resolveCombat(attacker, defender) {
  if (attacker.attackCooldown > 0 || !keysDown.has(attacker.controls.attack)) {
    return;
  }

  attacker.attackCooldown = ATTACK_COOLDOWN_MS;
  attacker.attackFlashTimer = 140;

  if (withinAttackRange(attacker, defender)) {
    defender.health = applyAttack(defender.health, 1);
    statusEl.textContent = `${attacker.label} hit ${defender.label}!`;
  }
}

function resolvePickups(player) {
  state.pickups = state.pickups.filter((pickup) => {
    if (!tryCollectPickup(player, pickup, player.radius + pickup.radius)) {
      return true;
    }

    const before = player.health;
    player.health = healPlayer(player.health, pickup.healAmount);
    if (player.health > before) {
      statusEl.textContent = `${player.label} collected blood +${pickup.healAmount}`;
      return false;
    }

    return true;
  });
}

function checkWinner() {
  const loser = state.players.find((p) => p.health <= 0);
  if (!loser) return;

  state.isGameOver = true;
  state.winner = state.players.find((p) => p !== loser) || null;
  statusEl.textContent = `${state.winner?.label ?? "Nobody"} wins! Press restart for a new duel.`;
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawPlayer(player) {
  const swing = player.isMoving ? Math.sin(player.walkTimer / 90) * 5.5 : 0;
  const bounce = player.isMoving ? Math.sin(player.walkTimer / 70) * 1.5 : 0;
  const torsoW = player.radius * 1.4;
  const torsoH = player.radius * 1.5;
  const headR = player.radius * 0.42;
  const attackGlow = player.attackFlashTimer > 0 ? player.attackFlashTimer / 140 : 0;

  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.facing.x < -0.08) {
    ctx.scale(-1, 1);
  }
  ctx.translate(0, bounce);

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, player.radius + 8, player.radius * 1.1, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20,25,45,0.85)";
  ctx.beginPath();
  ctx.moveTo(-6, 12);
  ctx.lineTo(-10, 20 + swing);
  ctx.moveTo(6, 12);
  ctx.lineTo(10, 20 - swing);
  ctx.stroke();

  roundedRectPath(-torsoW / 2, -8, torsoW, torsoH, 7);
  ctx.fillStyle = player.color;
  ctx.fill();

  roundedRectPath(-torsoW / 2, -8, torsoW, torsoH, 7);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = "#ffd8b3";
  ctx.beginPath();
  ctx.arc(0, -12, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2a45";
  ctx.beginPath();
  ctx.arc(5, -12, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#e8f0ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.lineTo(15 + attackGlow * 8, player.attackFlashTimer > 0 ? -14 : -5);
  ctx.stroke();

  if (player.attackFlashTimer > 0) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + attackGlow * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14, -13, 8 + attackGlow * 5, -0.8, 0.8);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPickup(pickup) {
  const pulse = 1 + 0.15 * Math.sin(performance.now() / 180);
  const r = pickup.radius * pulse;

  ctx.save();
  ctx.translate(pickup.x, pickup.y);
  ctx.fillStyle = "#63e6be";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2fd6ac";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, 0);
  ctx.lineTo(r * 0.6, 0);
  ctx.moveTo(0, -r * 0.6);
  ctx.lineTo(0, r * 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawArena() {
  ctx.clearRect(0, 0, arena.width, arena.height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let x = 0; x <= arena.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, arena.height);
    ctx.stroke();
  }
  for (let y = 0; y <= arena.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(arena.width, y);
    ctx.stroke();
  }

  state.pickups.forEach(drawPickup);
  state.players.forEach(drawPlayer);

  if (state.isGameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, arena.width, arena.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${state.winner?.label ?? "No one"} Wins!`, arena.width / 2, arena.height / 2 - 8);
    ctx.font = "22px Inter, sans-serif";
    ctx.fillText("Press Restart Match to play again", arena.width / 2, arena.height / 2 + 32);
  }
}

function tick(now) {
  const deltaMs = now - lastFrame;
  lastFrame = now;

  if (!state.isGameOver) {
    state.pickupSpawnTimer += deltaMs;
    if (state.pickupSpawnTimer >= state.pickupSpawnEveryMs) {
      state.pickupSpawnTimer = 0;
      spawnPickup();
    }

    const [p1, p2] = state.players;

    movePlayer(p1);
    movePlayer(p2);

    p1.attackCooldown = Math.max(0, p1.attackCooldown - deltaMs);
    p2.attackCooldown = Math.max(0, p2.attackCooldown - deltaMs);
  p1.attackFlashTimer = Math.max(0, p1.attackFlashTimer - deltaMs);
  p2.attackFlashTimer = Math.max(0, p2.attackFlashTimer - deltaMs);
  if (p1.isMoving) p1.walkTimer += deltaMs;
  if (p2.isMoving) p2.walkTimer += deltaMs;

    resolveCombat(p1, p2);
    resolveCombat(p2, p1);

    resolvePickups(p1);
    resolvePickups(p2);

    checkWinner();
    updateHud();
  }

  drawArena();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (pendingRebind) {
    event.preventDefault();
    if (event.code === "Escape") {
      pendingRebind = null;
      renderControlConfig();
      statusEl.textContent = "Key remap canceled.";
      return;
    }

    applyRebind(pendingRebind.playerId, pendingRebind.action, event.code);
    pendingRebind = null;
    renderControlConfig();
    return;
  }

  keysDown.add(event.code);
  if (event.code.startsWith("Arrow") || event.code === "Space") {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keysDown.delete(event.code);
});

controlConfigEl.addEventListener("click", (event) => {
  const button = event.target.closest(".keybind-btn");
  if (!button) return;

  const playerId = Number(button.dataset.playerId);
  const action = button.dataset.action;
  if (!playerId || !action) return;

  pendingRebind = { playerId, action };
  statusEl.textContent = `Press a key for ${state.players[playerId - 1].label} ${action}. (Esc to cancel)`;
  renderControlConfig();
});

restartBtn.addEventListener("click", resetGame);

updateHud();
renderControlConfig();
requestAnimationFrame(tick);
