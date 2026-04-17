const BASE_ASPECT_RATIO = 16 / 9;
const MOBILE_ASPECT_RATIO = 0.95;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const arenaFrame = document.getElementById("arenaFrame");
const joystickArea = document.getElementById("joystickArea");
const joystickBase = document.getElementById("joystickBase");
const joystickThumb = document.getElementById("joystickThumb");
const attackButton = document.getElementById("attackButton");
const mobileHint = document.getElementById("mobileHint");

const gameHud = document.getElementById("gameHud");
const levelValue = document.getElementById("levelValue");
const hpValue = document.getElementById("hpValue");
const scoreValue = document.getElementById("scoreValue");
const timeValue = document.getElementById("timeValue");
const killsValue = document.getElementById("killsValue");
const phaseValue = document.getElementById("phaseValue");
const xpValue = document.getElementById("xpValue");
const xpFill = document.getElementById("xpFill");
const finalLevel = document.getElementById("finalLevel");
const finalScore = document.getElementById("finalScore");
const finalTime = document.getElementById("finalTime");
const finalKills = document.getElementById("finalKills");
const gameOverPanel = document.getElementById("gameOverPanel");
const levelUpPanel = document.getElementById("levelUpPanel");
const upgradeOptions = document.getElementById("upgradeOptions");
const restartButton = document.getElementById("restartButton");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
};

const CONFIG = {
  basePlayerSpeed: 240,
  baseAttackDamage: 16,
  baseAttackCooldown: 0.75,
  attackCooldownFloor: 0.22,
  attackDuration: 0.16,
  baseAttackRange: 80,
  attackArc: Math.PI * 0.82,
  baseKnockbackForce: 150,
  enemyHitFlashDuration: 0.15,
  playerInvulnerabilityDuration: 1.1,
  openingProtectionDuration: 4.2,
  deathFadeDuration: 0.36,
  particleDuration: 0.3,
  xpOrbLife: 14,
  healOrbLife: 12,
  xpOrbMagnetRadius: 130,
  pickupRadius: 24,
  orbSpeed: 240,
  dashDistance: 108,
  dashCooldown: 3.2,
  dashInvulnerability: 0.35,
  spawnSafeDistance: 210,
  joystickMaxDistance: 34,
};

// Enemy definition data is centralized for easy extension with elites/bosses.
const ENEMY_TYPES = {
  normal: {
    id: "normal",
    radius: 14,
    maxHealth: 36,
    speed: 80,
    damage: 8,
    score: 10,
    xp: 8,
    color: "#8f2f24",
    hitColor: "#ff7867",
  },
  swift: {
    id: "swift",
    radius: 11,
    maxHealth: 22,
    speed: 134,
    damage: 6,
    score: 14,
    xp: 10,
    color: "#c98f2f",
    hitColor: "#ffd07e",
  },
  tank: {
    id: "tank",
    radius: 20,
    maxHealth: 70,
    speed: 52,
    damage: 13,
    score: 24,
    xp: 15,
    color: "#5e2d8c",
    hitColor: "#d39cff",
  },
};

// Upgrade definitions are centralized for future skill/equipment expansion.
const UPGRADE_DEFINITIONS = {
  attackDamage: {
    id: "attackDamage",
    title: "Attack Up",
    description: "Auto attack damage +6.",
    apply(player) {
      player.stats.attackDamage += 6;
    },
  },
  attackCooldown: {
    id: "attackCooldown",
    title: "Attack Speed",
    description: "Auto attack cooldown -0.08 sec.",
    apply(player) {
      player.stats.attackCooldown = Math.max(
        CONFIG.attackCooldownFloor,
        player.stats.attackCooldown - 0.08
      );
    },
  },
  attackRange: {
    id: "attackRange",
    title: "Range Up",
    description: "Attack range +14.",
    apply(player) {
      player.stats.attackRange += 14;
    },
  },
  maxHealth: {
    id: "maxHealth",
    title: "Vitality",
    description: "Max HP +24 and heal +24.",
    apply(player) {
      player.maxHealth += 24;
      player.health = Math.min(player.maxHealth, player.health + 24);
    },
  },
  moveSpeed: {
    id: "moveSpeed",
    title: "Quick Step",
    description: "Move speed +22.",
    apply(player) {
      player.stats.moveSpeed += 22;
    },
  },
  regen: {
    id: "regen",
    title: "Auto Heal",
    description: "Regenerate +1.2 HP/sec.",
    apply(player) {
      player.stats.regenPerSec += 1.2;
    },
  },
  knockback: {
    id: "knockback",
    title: "Heavy Blow",
    description: "Knockback force +25%.",
    apply(player) {
      player.stats.knockbackMultiplier += 0.25;
    },
  },
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  joystickX: 0,
  joystickY: 0,
};

const touchState = {
  joystickPointerId: null,
  skillPointerId: null,
};

let gameState;
let lastTimestamp = 0;
let animationFrameId = 0;

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getPhaseLabel(elapsed) {
  if (elapsed < 30) return "Phase 1";
  if (elapsed < 60) return "Phase 2";
  return "Phase 3+";
}

function getXpRequirement(level) {
  if (level <= 1) return 14;
  if (level === 2) return 20;
  return Math.floor(26 * Math.pow(1.33, level - 3));
}

function createPlayer() {
  return {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    radius: 16,
    maxHealth: 130,
    health: 130,
    moveX: 0,
    moveY: 1,
    attackTimer: 0,
    attackCooldownTimer: 0,
    damageCooldownTimer: CONFIG.openingProtectionDuration,
    dashCooldownTimer: 0,
    level: 1,
    experience: 0,
    experienceToNextLevel: getXpRequirement(1),
    stats: {
      attackDamage: CONFIG.baseAttackDamage,
      attackCooldown: CONFIG.baseAttackCooldown,
      attackRange: CONFIG.baseAttackRange,
      moveSpeed: CONFIG.basePlayerSpeed,
      regenPerSec: 0,
      knockbackMultiplier: 1,
    },
  };
}

function createInitialState() {
  return {
    player: createPlayer(),
    enemies: [],
    effects: [],
    xpOrbs: [],
    healOrbs: [],
    score: 0,
    kills: 0,
    elapsedTime: 0,
    spawnTimer: 0,
    isGameOver: false,
    isLevelUpPaused: false,
    pendingLevelUps: 0,
    currentUpgradeOptions: [],
  };
}

// Canvas resize keeps desktop ratio and gives mobile a taller gameplay window.
function resizeCanvas() {
  const previousWidth = WORLD.width;
  const previousHeight = WORLD.height;
  const isMobileLayout = window.matchMedia("(max-width: 720px)").matches;
  const viewportHeight = Math.floor(window.visualViewport?.height || window.innerHeight);
  const frameWidth = Math.max(280, Math.floor(arenaFrame.clientWidth || window.innerWidth - 10));
  let displayHeight = 0;

  if (isMobileLayout) {
    const minMobileHeight = Math.floor(viewportHeight * 0.55);
    const maxMobileHeight = Math.floor(viewportHeight * 0.7);
    const natural = Math.floor(frameWidth / MOBILE_ASPECT_RATIO);
    displayHeight = clamp(natural, minMobileHeight, maxMobileHeight);
  } else {
    displayHeight = Math.floor(frameWidth / BASE_ASPECT_RATIO);
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  arenaFrame.style.height = `${displayHeight}px`;
  canvas.style.width = `${frameWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  canvas.width = Math.floor(frameWidth * dpr);
  canvas.height = Math.floor(displayHeight * dpr);

  WORLD.width = frameWidth;
  WORLD.height = displayHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!gameState || previousWidth === 0 || previousHeight === 0) return;

  const sx = WORLD.width / previousWidth;
  const sy = WORLD.height / previousHeight;

  gameState.player.x *= sx;
  gameState.player.y *= sy;

  for (const enemy of gameState.enemies) {
    enemy.x *= sx;
    enemy.y *= sy;
  }
  for (const orb of gameState.xpOrbs) {
    orb.x *= sx;
    orb.y *= sy;
  }
  for (const orb of gameState.healOrbs) {
    orb.x *= sx;
    orb.y *= sy;
  }
  for (const fx of gameState.effects) {
    fx.x *= sx;
    fx.y *= sy;
  }

  gameState.player.x = clamp(gameState.player.x, gameState.player.radius, WORLD.width - gameState.player.radius);
  gameState.player.y = clamp(gameState.player.y, gameState.player.radius, WORLD.height - gameState.player.radius);
}

function createEnemy(typeId, x, y) {
  const type = ENEMY_TYPES[typeId];
  return {
    typeId,
    x,
    y,
    radius: type.radius,
    health: type.maxHealth,
    maxHealth: type.maxHealth,
    speed: type.speed,
    damage: type.damage,
    score: type.score,
    xp: type.xp,
    color: type.color,
    hitColor: type.hitColor,
    hitFlashTimer: 0,
    knockbackX: 0,
    knockbackY: 0,
  };
}

function getSpawnProfile(elapsed) {
  if (elapsed < 30) {
    return {
      interval: 1.48 - (elapsed / 30) * 0.28,
      weights: { normal: 0.96, swift: 0.04, tank: 0 },
      extraSpawnChance: 0,
    };
  }

  if (elapsed < 60) {
    const progress = (elapsed - 30) / 30;
    return {
      interval: 1.2 - progress * 0.2,
      weights: { normal: 0.78, swift: 0.18, tank: 0.04 },
      extraSpawnChance: 0.08 + progress * 0.08,
    };
  }

  const late = Math.min(1, (elapsed - 60) / 120);
  return {
    interval: 1.0 - late * 0.28,
    weights: { normal: 0.56, swift: 0.27, tank: 0.17 },
    extraSpawnChance: 0.2 + late * 0.16,
  };
}

function chooseEnemyType(elapsed) {
  const { weights } = getSpawnProfile(elapsed);
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;

  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return "normal";
}

function findSafeSpawnPosition() {
  const margin = 42;
  const player = gameState.player;
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  for (let i = 0; i < 16; i += 1) {
    if (side === 0) {
      x = randomRange(0, WORLD.width);
      y = -margin;
    } else if (side === 1) {
      x = WORLD.width + margin;
      y = randomRange(0, WORLD.height);
    } else if (side === 2) {
      x = randomRange(0, WORLD.width);
      y = WORLD.height + margin;
    } else {
      x = -margin;
      y = randomRange(0, WORLD.height);
    }

    if (Math.hypot(x - player.x, y - player.y) >= CONFIG.spawnSafeDistance) {
      return { x, y };
    }
  }

  return { x, y };
}

function spawnEnemy() {
  const typeId = chooseEnemyType(gameState.elapsedTime);
  const pos = findSafeSpawnPosition();
  gameState.enemies.push(createEnemy(typeId, pos.x, pos.y));
}

function spawnDeathEffect(enemy) {
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + randomRange(-0.22, 0.22);
    const speed = randomRange(56, 138);
    gameState.effects.push({
      type: "particle",
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: randomRange(2, 4),
      life: CONFIG.particleDuration,
      maxLife: CONFIG.particleDuration,
      color: enemy.color,
    });
  }

  gameState.effects.push({
    type: "fade",
    x: enemy.x,
    y: enemy.y,
    radius: enemy.radius,
    life: CONFIG.deathFadeDuration,
    maxLife: CONFIG.deathFadeDuration,
    color: enemy.color,
  });
}

function spawnXpOrb(enemy) {
  gameState.xpOrbs.push({
    x: enemy.x,
    y: enemy.y,
    radius: clamp(enemy.radius * 0.44, 6, 10),
    value: enemy.xp,
    life: CONFIG.xpOrbLife,
  });
}

function spawnHealOrb(enemy) {
  gameState.healOrbs.push({
    x: enemy.x,
    y: enemy.y,
    radius: 7,
    heal: 18,
    life: CONFIG.healOrbLife,
  });
}

function tryDropHealOrb(enemy) {
  const player = gameState.player;
  const hpRatio = player.health / player.maxHealth;
  const bonus = hpRatio < 0.5 ? (0.5 - hpRatio) * 0.7 : 0;
  const dropChance = 0.06 + bonus;

  if (Math.random() < dropChance) {
    spawnHealOrb(enemy);
  }
}

function getNearestEnemy() {
  const player = gameState.player;
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of gameState.enemies) {
    const dist = distanceBetween(player, enemy);
    if (dist < nearestDistance) {
      nearest = enemy;
      nearestDistance = dist;
    }
  }

  return { nearest, distance: nearestDistance };
}

function resetTouchControls() {
  input.joystickX = 0;
  input.joystickY = 0;
  joystickBase.classList.remove("is-active");
  attackButton.classList.remove("is-active");
  attackButton.classList.remove("is-pressed");
  joystickThumb.style.transform = "translate(-50%, -50%)";
  touchState.joystickPointerId = null;
  touchState.skillPointerId = null;
}

function showMobileHint() {
  if (!mobileHint) return;
  if (!window.matchMedia("(pointer: coarse), (max-width: 720px)").matches) return;
  if (localStorage.getItem("mini_diablo_mobile_hint_seen") === "1") return;

  mobileHint.classList.add("visible");
  setTimeout(() => {
    mobileHint.classList.add("fade");
  }, 2000);
  setTimeout(() => {
    mobileHint.classList.remove("visible");
    localStorage.setItem("mini_diablo_mobile_hint_seen", "1");
  }, 2600);
}

function resetGame() {
  gameState = createInitialState();
  lastTimestamp = 0;
  gameOverPanel.classList.add("hidden");
  levelUpPanel.classList.add("hidden");
  upgradeOptions.innerHTML = "";
  resetTouchControls();
  resizeCanvas();
  updateHud();
  showMobileHint();
}

function updatePlayer(deltaTime) {
  const player = gameState.player;
  const keyboardX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const keyboardY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  let moveX = keyboardX + input.joystickX;
  let moveY = keyboardY + input.joystickY;

  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    moveX /= len;
    moveY /= len;
    player.moveX = moveX;
    player.moveY = moveY;
  }

  player.x += moveX * player.stats.moveSpeed * deltaTime;
  player.y += moveY * player.stats.moveSpeed * deltaTime;
  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);

  if (player.stats.regenPerSec > 0) {
    player.health = Math.min(player.maxHealth, player.health + player.stats.regenPerSec * deltaTime);
  }

  player.attackTimer = Math.max(0, player.attackTimer - deltaTime);
  player.attackCooldownTimer = Math.max(0, player.attackCooldownTimer - deltaTime);
  player.damageCooldownTimer = Math.max(0, player.damageCooldownTimer - deltaTime);
  player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - deltaTime);
}

function updateEnemies(deltaTime) {
  const player = gameState.player;

  for (const enemy of gameState.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;

    enemy.knockbackX *= 0.84;
    enemy.knockbackY *= 0.84;
    enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - deltaTime);

    enemy.x += ((dx / len) * enemy.speed + enemy.knockbackX) * deltaTime;
    enemy.y += ((dy / len) * enemy.speed + enemy.knockbackY) * deltaTime;
    enemy.x = clamp(enemy.x, enemy.radius, WORLD.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, WORLD.height - enemy.radius);

    const touching = distanceBetween(enemy, player) < enemy.radius + player.radius;
    if (touching && player.damageCooldownTimer <= 0) {
      player.health = Math.max(0, player.health - enemy.damage);
      player.damageCooldownTimer = CONFIG.playerInvulnerabilityDuration;
    }
  }
}

function updateEffects(deltaTime) {
  gameState.effects = gameState.effects.filter((fx) => {
    fx.life -= deltaTime;
    if (fx.type === "particle") {
      fx.x += fx.vx * deltaTime;
      fx.y += fx.vy * deltaTime;
      fx.vx *= 0.94;
      fx.vy *= 0.94;
    }
    return fx.life > 0;
  });
}

function gainExperience(amount) {
  const player = gameState.player;
  player.experience += amount;

  while (player.experience >= player.experienceToNextLevel) {
    player.experience -= player.experienceToNextLevel;
    player.level += 1;
    player.experienceToNextLevel = getXpRequirement(player.level);
    gameState.pendingLevelUps += 1;
  }

  if (gameState.pendingLevelUps > 0 && !gameState.isLevelUpPaused) {
    openLevelUpPanel();
  }
}

function updateDropOrbs(deltaTime) {
  const player = gameState.player;

  gameState.xpOrbs = gameState.xpOrbs.filter((orb) => {
    orb.life -= deltaTime;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < CONFIG.xpOrbMagnetRadius) {
      orb.x += (dx / dist) * CONFIG.orbSpeed * deltaTime;
      orb.y += (dy / dist) * CONFIG.orbSpeed * deltaTime;
    }

    if (dist < player.radius + CONFIG.pickupRadius) {
      gainExperience(orb.value);
      return false;
    }

    return orb.life > 0;
  });

  gameState.healOrbs = gameState.healOrbs.filter((orb) => {
    orb.life -= deltaTime;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < CONFIG.xpOrbMagnetRadius * 0.84) {
      orb.x += (dx / dist) * CONFIG.orbSpeed * 0.88 * deltaTime;
      orb.y += (dy / dist) * CONFIG.orbSpeed * 0.88 * deltaTime;
    }

    if (dist < player.radius + CONFIG.pickupRadius) {
      player.health = Math.min(player.maxHealth, player.health + orb.heal);
      return false;
    }

    return orb.life > 0;
  });
}

function getRandomUpgradeChoices(count) {
  return shuffleArray(Object.values(UPGRADE_DEFINITIONS)).slice(0, count);
}

function renderUpgradeOptions() {
  upgradeOptions.innerHTML = "";
  for (const option of gameState.currentUpgradeOptions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-option";
    button.innerHTML = `<h2>${option.title}</h2><p>${option.description}</p>`;
    button.addEventListener("click", () => applyUpgrade(option.id));
    upgradeOptions.appendChild(button);
  }
}

function openLevelUpPanel() {
  gameState.isLevelUpPaused = true;
  gameState.currentUpgradeOptions = getRandomUpgradeChoices(3);
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.joystickX = 0;
  input.joystickY = 0;
  joystickThumb.style.transform = "translate(-50%, -50%)";
  renderUpgradeOptions();
  levelUpPanel.classList.remove("hidden");
}

function applyUpgrade(upgradeId) {
  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  if (!upgrade) return;

  upgrade.apply(gameState.player);
  gameState.pendingLevelUps = Math.max(0, gameState.pendingLevelUps - 1);
  gameState.isLevelUpPaused = false;
  gameState.currentUpgradeOptions = [];
  levelUpPanel.classList.add("hidden");
  upgradeOptions.innerHTML = "";

  if (gameState.pendingLevelUps > 0) {
    openLevelUpPanel();
  }
}

function tryDash() {
  const player = gameState.player;
  if (gameState.isLevelUpPaused || gameState.isGameOver) return;
  if (player.dashCooldownTimer > 0) return;

  const dirX = player.moveX || 1;
  const dirY = player.moveY || 0;
  player.x += dirX * CONFIG.dashDistance;
  player.y += dirY * CONFIG.dashDistance;
  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);
  player.dashCooldownTimer = CONFIG.dashCooldown;
  player.damageCooldownTimer = Math.max(player.damageCooldownTimer, CONFIG.dashInvulnerability);

  gameState.effects.push({
    type: "fade",
    x: player.x,
    y: player.y,
    radius: 16,
    life: 0.18,
    maxLife: 0.18,
    color: "#d9f1ab",
  });
}

// Auto attack: lock nearest target, face toward it, attack when in range and cooldown ready.
function updateAutoAttack() {
  const player = gameState.player;
  const { nearest, distance } = getNearestEnemy();
  if (!nearest) return;

  const dx = nearest.x - player.x;
  const dy = nearest.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  const faceX = dx / len;
  const faceY = dy / len;
  player.moveX = faceX;
  player.moveY = faceY;

  if (player.attackCooldownTimer > 0) return;
  if (distance > player.stats.attackRange + nearest.radius) return;

  player.attackTimer = CONFIG.attackDuration;
  player.attackCooldownTimer = player.stats.attackCooldown;
  const attackAngle = Math.atan2(faceY, faceX);

  gameState.enemies = gameState.enemies.filter((enemy) => {
    const ex = enemy.x - player.x;
    const ey = enemy.y - player.y;
    const dist = Math.hypot(ex, ey);
    if (dist > player.stats.attackRange + enemy.radius) return true;

    const enemyAngle = Math.atan2(ey, ex);
    const delta = Math.atan2(Math.sin(enemyAngle - attackAngle), Math.cos(enemyAngle - attackAngle));
    if (Math.abs(delta) > CONFIG.attackArc / 2) return true;

    enemy.health -= player.stats.attackDamage;
    enemy.hitFlashTimer = CONFIG.enemyHitFlashDuration;
    const safe = dist || 1;
    const kb = CONFIG.baseKnockbackForce * player.stats.knockbackMultiplier;
    enemy.knockbackX = (ex / safe) * kb;
    enemy.knockbackY = (ey / safe) * kb;

    if (enemy.health <= 0) {
      gameState.kills += 1;
      gameState.score += enemy.score;
      spawnDeathEffect(enemy);
      spawnXpOrb(enemy);
      tryDropHealOrb(enemy);
      return false;
    }
    return true;
  });
}

function updateSpawning(deltaTime) {
  const profile = getSpawnProfile(gameState.elapsedTime);
  gameState.spawnTimer += deltaTime;

  while (gameState.spawnTimer >= profile.interval) {
    gameState.spawnTimer -= profile.interval;
    spawnEnemy();

    if (Math.random() < profile.extraSpawnChance) {
      spawnEnemy();
    }
  }
}

function updateGame(deltaTime) {
  if (gameState.isGameOver) return;

  updateEffects(deltaTime);

  if (gameState.isLevelUpPaused) {
    updateHud();
    return;
  }

  gameState.elapsedTime += deltaTime;
  updatePlayer(deltaTime);
  updateEnemies(deltaTime);
  updateAutoAttack();
  updateDropOrbs(deltaTime);
  updateSpawning(deltaTime);
  updateHud();

  if (gameState.player.health <= 0) {
    gameState.isGameOver = true;
    finalLevel.textContent = `Level: ${gameState.player.level}`;
    finalScore.textContent = `Score: ${gameState.score}`;
    finalTime.textContent = `Survival: ${formatTime(gameState.elapsedTime)}`;
    finalKills.textContent = `Kills: ${gameState.kills}`;
    gameOverPanel.classList.remove("hidden");
  }
}

function updateHud() {
  const player = gameState.player;
  levelValue.textContent = String(player.level);
  hpValue.textContent = `${Math.max(0, Math.ceil(player.health))} / ${player.maxHealth}`;
  scoreValue.textContent = String(gameState.score);
  timeValue.textContent = formatTime(gameState.elapsedTime);
  killsValue.textContent = `K ${gameState.kills}`;
  phaseValue.textContent = getPhaseLabel(gameState.elapsedTime);
  xpValue.textContent = `${Math.floor(player.experience)} / ${player.experienceToNextLevel}`;
  xpFill.style.width = `${(player.experience / player.experienceToNextLevel) * 100}%`;
  gameHud.classList.toggle("low-hp", player.health / player.maxHealth < 0.3);
}

function drawBackgroundDetails() {
  ctx.save();
  ctx.strokeStyle = "rgba(189, 224, 171, 0.05)";
  ctx.lineWidth = 1;

  for (let x = 16; x < WORLD.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }

  for (let y = 16; y < WORLD.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlayer(player) {
  ctx.save();

  if (player.attackTimer > 0) {
    const angle = Math.atan2(player.moveY, player.moveX);
    const progress = player.attackTimer / CONFIG.attackDuration;
    ctx.fillStyle = `rgba(239, 172, 77, ${0.12 + progress * 0.24})`;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(
      player.x,
      player.y,
      player.stats.attackRange,
      angle - CONFIG.attackArc / 2,
      angle + CONFIG.attackArc / 2
    );
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 231, 158, ${0.18 + progress * 0.54})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  if (player.damageCooldownTimer > 0) {
    const flicker = Math.floor(player.damageCooldownTimer * 20) % 2 === 0;
    ctx.globalAlpha = flicker ? 0.36 : 1;
  }

  ctx.fillStyle = player.damageCooldownTimer > 0 ? "#f1b1a4" : "#d7e8d0";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#293728";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(
    player.x + player.moveX * (player.radius + 12),
    player.y + player.moveY * (player.radius + 12)
  );
  ctx.stroke();

  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.fillStyle = enemy.hitFlashTimer > 0 ? enemy.hitColor : enemy.color;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fill();

  const barWidth = enemy.radius * 2.08;
  const ratio = enemy.health / enemy.maxHealth;
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth, 5);
  ctx.fillStyle = "#9fcb74";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth * ratio, 5);
  ctx.restore();
}

function drawOrbs() {
  for (const orb of gameState.xpOrbs) {
    ctx.save();
    ctx.fillStyle = "#d6f08f";
    ctx.shadowBlur = 16;
    ctx.shadowColor = "rgba(214, 240, 143, 0.55)";
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const orb of gameState.healOrbs) {
    ctx.save();
    ctx.fillStyle = "#71d7a4";
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(113, 215, 164, 0.5)";
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEffects() {
  for (const fx of gameState.effects) {
    const alpha = clamp(fx.life / fx.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (fx.type === "fade") {
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius + (1 - alpha) * 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.type === "particle") {
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawGame() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawBackgroundDetails();

  for (const enemy of gameState.enemies) {
    drawEnemy(enemy);
  }

  drawOrbs();
  drawEffects();
  drawPlayer(gameState.player);
}

function updateJoystickFromPointer(clientX, clientY) {
  const baseRect = joystickBase.getBoundingClientRect();
  const cx = baseRect.left + baseRect.width / 2;
  const cy = baseRect.top + baseRect.height / 2;
  const rx = clientX - cx;
  const ry = clientY - cy;
  const dist = Math.hypot(rx, ry);
  const limited = Math.min(dist, CONFIG.joystickMaxDistance);
  const angle = Math.atan2(ry, rx);
  const tx = Math.cos(angle) * limited;
  const ty = Math.sin(angle) * limited;

  input.joystickX = dist === 0 ? 0 : tx / CONFIG.joystickMaxDistance;
  input.joystickY = dist === 0 ? 0 : ty / CONFIG.joystickMaxDistance;
  joystickThumb.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
}

function releaseJoystick() {
  input.joystickX = 0;
  input.joystickY = 0;
  touchState.joystickPointerId = null;
  joystickBase.classList.remove("is-active");
  joystickThumb.style.transform = "translate(-50%, -50%)";
}

function setupTouchControls() {
  joystickArea.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (touchState.joystickPointerId !== null) return;

    touchState.joystickPointerId = event.pointerId;
    joystickBase.classList.add("is-active");
    joystickArea.setPointerCapture(event.pointerId);
    updateJoystickFromPointer(event.clientX, event.clientY);
  });

  joystickArea.addEventListener("pointermove", (event) => {
    if (touchState.joystickPointerId !== event.pointerId) return;
    event.preventDefault();
    updateJoystickFromPointer(event.clientX, event.clientY);
  });

  const endJoystickPointer = (event) => {
    if (touchState.joystickPointerId !== event.pointerId) return;
    event.preventDefault();
    releaseJoystick();
  };

  joystickArea.addEventListener("pointerup", endJoystickPointer);
  joystickArea.addEventListener("pointercancel", endJoystickPointer);
  joystickArea.addEventListener("lostpointercapture", releaseJoystick);

  attackButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    touchState.skillPointerId = event.pointerId;
    attackButton.classList.add("is-active");
    attackButton.classList.add("is-pressed");
    tryDash();
  });

  const releaseSkillPointer = (event) => {
    if (touchState.skillPointerId !== null && event.pointerId !== touchState.skillPointerId) {
      return;
    }
    event.preventDefault();
    touchState.skillPointerId = null;
    attackButton.classList.remove("is-active");
    attackButton.classList.remove("is-pressed");
  };

  attackButton.addEventListener("pointerup", releaseSkillPointer);
  attackButton.addEventListener("pointercancel", releaseSkillPointer);

  arenaFrame.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

function setMovementKey(code, isPressed) {
  if (code === "KeyW") input.up = isPressed;
  if (code === "KeyS") input.down = isPressed;
  if (code === "KeyA") input.left = isPressed;
  if (code === "KeyD") input.right = isPressed;
}

window.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (gameState?.isLevelUpPaused) {
    setMovementKey(event.code, false);
    return;
  }

  setMovementKey(event.code, true);

  if (event.code === "Space" && !event.repeat) {
    tryDash();
  }
});

window.addEventListener("keyup", (event) => {
  setMovementKey(event.code, false);
});

window.addEventListener("resize", () => {
  resizeCanvas();
});

restartButton.addEventListener("click", () => {
  resetGame();
});

function gameLoop(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;

  updateGame(deltaTime);
  drawGame();

  animationFrameId = window.requestAnimationFrame(gameLoop);
}

function init() {
  resetGame();
  setupTouchControls();
  window.cancelAnimationFrame(animationFrameId);
  animationFrameId = window.requestAnimationFrame(gameLoop);
}

init();
