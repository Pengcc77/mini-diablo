const BASE_ASPECT_RATIO = 16 / 9;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const arenaFrame = document.getElementById("arenaFrame");
const joystickArea = document.getElementById("joystickArea");
const joystickBase = document.getElementById("joystickBase");
const joystickThumb = document.getElementById("joystickThumb");
const attackButton = document.getElementById("attackButton");

const levelValue = document.getElementById("levelValue");
const hpValue = document.getElementById("hpValue");
const scoreValue = document.getElementById("scoreValue");
const xpValue = document.getElementById("xpValue");
const xpFill = document.getElementById("xpFill");
const finalScore = document.getElementById("finalScore");
const gameOverPanel = document.getElementById("gameOverPanel");
const levelUpPanel = document.getElementById("levelUpPanel");
const upgradeOptions = document.getElementById("upgradeOptions");
const restartButton = document.getElementById("restartButton");
const qrUrlInput = document.getElementById("qrUrlInput");
const generateQrButton = document.getElementById("generateQrButton");
const qrCanvas = document.getElementById("qrCanvas");
const qrStatus = document.getElementById("qrStatus");
const downloadQrLink = document.getElementById("downloadQrLink");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
};

const CONFIG = {
  basePlayerSpeed: 260,
  enemySpawnInterval: 950,
  baseAttackDamage: 20,
  baseAttackCooldown: 0.4,
  attackCooldownFloor: 0.12,
  attackDuration: 0.14,
  baseAttackRange: 56,
  attackArc: Math.PI * 0.9,
  enemyHitFlashDuration: 0.15,
  enemyKnockbackStrength: 160,
  playerInvulnerabilityDuration: 0.8,
  deathFadeDuration: 0.35,
  particleDuration: 0.3,
  xpOrbLife: 12,
  xpOrbMagnetRadius: 120,
  xpOrbPickupRadius: 22,
  xpOrbSpeed: 220,
  baseXpToNextLevel: 20,
  xpGrowthFactor: 1.35,
  joystickMaxDistance: 36,
};

// 敵人定義集中管理。之後若新增遠程怪、菁英怪或 Boss，
// 只要補這個設定物件與對應權重邏輯即可。
const ENEMY_TYPES = {
  normal: {
    id: "normal",
    name: "普通怪",
    radius: 14,
    maxHealth: 38,
    speed: 84,
    damage: 12,
    score: 10,
    xp: 8,
    color: "#8f2f24",
    hitColor: "#ff7867",
  },
  swift: {
    id: "swift",
    name: "快速怪",
    radius: 11,
    maxHealth: 22,
    speed: 142,
    damage: 8,
    score: 14,
    xp: 10,
    color: "#c98f2f",
    hitColor: "#ffd07e",
  },
  tank: {
    id: "tank",
    name: "坦克怪",
    radius: 20,
    maxHealth: 72,
    speed: 55,
    damage: 18,
    score: 24,
    xp: 16,
    color: "#5e2d8c",
    hitColor: "#d39cff",
  },
};

// 升級定義集中管理，之後要擴充技能系統時，
// 只要在這裡新增條目與 apply 函式即可。
const UPGRADE_DEFINITIONS = {
  attackDamage: {
    id: "attackDamage",
    title: "攻擊力提升",
    description: "每次近戰傷害 +6，讓清怪更穩定。",
    apply(player) {
      player.stats.attackDamage += 6;
    },
  },
  attackCooldown: {
    id: "attackCooldown",
    title: "攻擊冷卻縮短",
    description: "攻擊冷卻 -0.04 秒，讓輸出更流暢。",
    apply(player) {
      player.stats.attackCooldown = Math.max(
        CONFIG.attackCooldownFloor,
        player.stats.attackCooldown - 0.04
      );
    },
  },
  maxHealth: {
    id: "maxHealth",
    title: "最大生命增加",
    description: "最大生命 +20，並立即回復 20 生命。",
    apply(player) {
      player.maxHealth += 20;
      player.health = Math.min(player.maxHealth, player.health + 20);
    },
  },
  moveSpeed: {
    id: "moveSpeed",
    title: "移動速度增加",
    description: "移動速度 +24，走位更從容。",
    apply(player) {
      player.stats.moveSpeed += 24;
    },
  },
  attackRange: {
    id: "attackRange",
    title: "攻擊範圍增加",
    description: "近戰範圍 +10，清怪更安全。",
    apply(player) {
      player.stats.attackRange += 10;
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
  attackPointerId: null,
};

let gameState;
let lastTimestamp = 0;
let animationFrameId = 0;
let qrInstance = null;

function createPlayer() {
  return {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    radius: 16,
    maxHealth: 100,
    health: 100,
    moveX: 0,
    moveY: 1,
    attackTimer: 0,
    attackCooldownTimer: 0,
    damageCooldownTimer: 0,
    level: 1,
    experience: 0,
    experienceToNextLevel: CONFIG.baseXpToNextLevel,
    stats: {
      attackDamage: CONFIG.baseAttackDamage,
      attackCooldown: CONFIG.baseAttackCooldown,
      moveSpeed: CONFIG.basePlayerSpeed,
      attackRange: CONFIG.baseAttackRange,
    },
  };
}

function createInitialState() {
  return {
    player: createPlayer(),
    enemies: [],
    effects: [],
    xpOrbs: [],
    score: 0,
    spawnTimer: 0,
    elapsedTime: 0,
    isGameOver: false,
    isLevelUpPaused: false,
    pendingLevelUps: 0,
    currentUpgradeOptions: [],
  };
}

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

function getExperienceRequirement(level) {
  return Math.floor(CONFIG.baseXpToNextLevel * Math.pow(CONFIG.xpGrowthFactor, level - 1));
}

// 讓 canvas 依容器寬度自動縮放，同時同步遊戲世界尺寸。
// 這樣桌機與手機都能共用同一套更新與繪圖邏輯。
function resizeCanvas() {
  const previousWidth = WORLD.width;
  const previousHeight = WORLD.height;
  const displayWidth = Math.max(320, Math.floor(arenaFrame.clientWidth));
  const displayHeight = Math.floor(displayWidth / BASE_ASPECT_RATIO);
  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  canvas.width = Math.floor(displayWidth * devicePixelRatio);
  canvas.height = Math.floor(displayHeight * devicePixelRatio);

  WORLD.width = displayWidth;
  WORLD.height = displayHeight;

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  if (!gameState || previousWidth === 0 || previousHeight === 0) {
    return;
  }

  const scaleX = WORLD.width / previousWidth;
  const scaleY = WORLD.height / previousHeight;

  // 世界尺寸改變時，將既有物件的位置按比例換算，避免旋轉螢幕時角色跳位。
  gameState.player.x *= scaleX;
  gameState.player.y *= scaleY;

  for (const enemy of gameState.enemies) {
    enemy.x *= scaleX;
    enemy.y *= scaleY;
  }

  for (const orb of gameState.xpOrbs) {
    orb.x *= scaleX;
    orb.y *= scaleY;
  }

  for (const effect of gameState.effects) {
    effect.x *= scaleX;
    effect.y *= scaleY;
  }

  gameState.player.x = clamp(gameState.player.x, gameState.player.radius, WORLD.width - gameState.player.radius);
  gameState.player.y = clamp(gameState.player.y, gameState.player.radius, WORLD.height - gameState.player.radius);
}

function createEnemy(typeId, x, y) {
  const type = ENEMY_TYPES[typeId];

  return {
    typeId,
    type,
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

function getEnemySpawnWeights(elapsedTime) {
  const minutes = elapsedTime / 60;

  // 隨遊戲時間提升高威脅敵人的比重。
  return {
    normal: Math.max(0.24, 0.78 - minutes * 0.08),
    swift: Math.min(0.42, 0.16 + minutes * 0.045),
    tank: Math.min(0.34, 0.06 + minutes * 0.035),
  };
}

function chooseEnemyType(elapsedTime) {
  const weights = getEnemySpawnWeights(elapsedTime);
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const [typeId, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return typeId;
    }
  }

  return "normal";
}

function spawnDeathEffect(enemy) {
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + randomRange(-0.2, 0.2);
    const speed = randomRange(60, 140);
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

// 經驗值掉落獨立成可收集物件，之後若擴充金幣、掉寶或磁吸效果，
// 可以沿用相同的 update / draw 流程。
function spawnExperienceOrb(enemy) {
  gameState.xpOrbs.push({
    x: enemy.x,
    y: enemy.y,
    radius: clamp(enemy.radius * 0.45, 6, 10),
    value: enemy.xp,
    life: CONFIG.xpOrbLife,
  });
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const margin = 40;
  const typeId = chooseEnemyType(gameState.elapsedTime);
  let x = 0;
  let y = 0;

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

  gameState.enemies.push(createEnemy(typeId, x, y));
}

function resetTouchControls() {
  input.joystickX = 0;
  input.joystickY = 0;
  attackButton.classList.remove("is-pressed");
  joystickThumb.style.transform = "translate(-50%, -50%)";
  touchState.joystickPointerId = null;
  touchState.attackPointerId = null;
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
}

function updatePlayer(deltaTime) {
  const player = gameState.player;
  const keyboardX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const keyboardY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  // 搖桿輸入與鍵盤輸入合併，讓桌機和手機共用同一套移動邏輯。
  let moveX = keyboardX + input.joystickX;
  let moveY = keyboardY + input.joystickY;

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    moveX /= length;
    moveY /= length;
    player.moveX = moveX;
    player.moveY = moveY;
  }

  player.x += moveX * player.stats.moveSpeed * deltaTime;
  player.y += moveY * player.stats.moveSpeed * deltaTime;
  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);

  player.attackTimer = Math.max(0, player.attackTimer - deltaTime);
  player.attackCooldownTimer = Math.max(0, player.attackCooldownTimer - deltaTime);
  player.damageCooldownTimer = Math.max(0, player.damageCooldownTimer - deltaTime);
}

function updateEnemies(deltaTime) {
  const player = gameState.player;

  for (const enemy of gameState.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;

    enemy.knockbackX *= 0.84;
    enemy.knockbackY *= 0.84;
    enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - deltaTime);

    enemy.x += ((dx / length) * enemy.speed + enemy.knockbackX) * deltaTime;
    enemy.y += ((dy / length) * enemy.speed + enemy.knockbackY) * deltaTime;
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
  gameState.effects = gameState.effects.filter((effect) => {
    effect.life -= deltaTime;

    if (effect.type === "particle") {
      effect.x += effect.vx * deltaTime;
      effect.y += effect.vy * deltaTime;
      effect.vx *= 0.94;
      effect.vy *= 0.94;
    }

    return effect.life > 0;
  });
}

function gainExperience(amount) {
  const player = gameState.player;
  player.experience += amount;

  // 升級檢查集中在這裡，之後若加入多段經驗曲線或被動增益，
  // 只需要改這個入口即可。
  while (player.experience >= player.experienceToNextLevel) {
    player.experience -= player.experienceToNextLevel;
    player.level += 1;
    player.experienceToNextLevel = getExperienceRequirement(player.level);
    gameState.pendingLevelUps += 1;
  }

  if (gameState.pendingLevelUps > 0 && !gameState.isLevelUpPaused) {
    openLevelUpPanel();
  }
}

function updateExperienceOrbs(deltaTime) {
  const player = gameState.player;

  gameState.xpOrbs = gameState.xpOrbs.filter((orb) => {
    orb.life -= deltaTime;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance < CONFIG.xpOrbMagnetRadius) {
      orb.x += (dx / distance) * CONFIG.xpOrbSpeed * deltaTime;
      orb.y += (dy / distance) * CONFIG.xpOrbSpeed * deltaTime;
    }

    if (distance < player.radius + CONFIG.xpOrbPickupRadius) {
      gainExperience(orb.value);
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
    button.innerHTML = `
      <h2>${option.title}</h2>
      <p>${option.description}</p>
    `;
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
  updateHud();
}

function applyUpgrade(upgradeId) {
  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  if (!upgrade) {
    return;
  }

  upgrade.apply(gameState.player);
  gameState.pendingLevelUps = Math.max(0, gameState.pendingLevelUps - 1);
  gameState.isLevelUpPaused = false;
  gameState.currentUpgradeOptions = [];
  levelUpPanel.classList.add("hidden");
  upgradeOptions.innerHTML = "";

  if (gameState.pendingLevelUps > 0) {
    openLevelUpPanel();
    return;
  }

  updateHud();
}

function performAttack() {
  const player = gameState.player;

  if (gameState.isGameOver || gameState.isLevelUpPaused || player.attackCooldownTimer > 0) {
    return;
  }

  player.attackTimer = CONFIG.attackDuration;
  player.attackCooldownTimer = player.stats.attackCooldown;

  const attackAngle = Math.atan2(player.moveY, player.moveX);

  gameState.enemies = gameState.enemies.filter((enemy) => {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);

    if (distance > player.stats.attackRange + enemy.radius) {
      return true;
    }

    const enemyAngle = Math.atan2(dy, dx);
    const angleDelta = Math.atan2(
      Math.sin(enemyAngle - attackAngle),
      Math.cos(enemyAngle - attackAngle)
    );

    if (Math.abs(angleDelta) > CONFIG.attackArc / 2) {
      return true;
    }

    enemy.health -= player.stats.attackDamage;
    enemy.hitFlashTimer = CONFIG.enemyHitFlashDuration;

    const safeDistance = distance || 1;
    enemy.knockbackX = (dx / safeDistance) * CONFIG.enemyKnockbackStrength;
    enemy.knockbackY = (dy / safeDistance) * CONFIG.enemyKnockbackStrength;

    if (enemy.health <= 0) {
      gameState.score += enemy.score;
      spawnDeathEffect(enemy);
      spawnExperienceOrb(enemy);
      return false;
    }

    return true;
  });
}

function updateSpawning(deltaTime) {
  gameState.spawnTimer += deltaTime;

  while (gameState.spawnTimer >= CONFIG.enemySpawnInterval / 1000) {
    gameState.spawnTimer -= CONFIG.enemySpawnInterval / 1000;
    spawnEnemy();
  }
}

function updateGame(deltaTime) {
  if (gameState.isGameOver) {
    return;
  }

  updateEffects(deltaTime);

  if (gameState.isLevelUpPaused) {
    updateHud();
    return;
  }

  gameState.elapsedTime += deltaTime;
  updatePlayer(deltaTime);
  updateEnemies(deltaTime);
  updateExperienceOrbs(deltaTime);
  updateSpawning(deltaTime);
  updateHud();

  if (gameState.player.health <= 0) {
    gameState.isGameOver = true;
    finalScore.textContent = `Final Score: ${gameState.score}`;
    gameOverPanel.classList.remove("hidden");
  }
}

function updateHud() {
  const player = gameState.player;
  levelValue.textContent = String(player.level);
  hpValue.textContent = `${Math.max(0, Math.ceil(player.health))} / ${player.maxHealth}`;
  scoreValue.textContent = String(gameState.score);
  xpValue.textContent = `${Math.floor(player.experience)} / ${player.experienceToNextLevel}`;
  xpFill.style.width = `${(player.experience / player.experienceToNextLevel) * 100}%`;
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
    ctx.fillStyle = `rgba(239, 172, 77, ${0.12 + progress * 0.22})`;
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

    ctx.strokeStyle = `rgba(255, 231, 158, ${0.16 + progress * 0.5})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  if (player.damageCooldownTimer > 0) {
    const flicker = Math.floor(player.damageCooldownTimer * 18) % 2 === 0;
    ctx.globalAlpha = flicker ? 0.35 : 1;
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

  const barWidth = enemy.radius * 2.1;
  const healthRatio = enemy.health / enemy.maxHealth;
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth, 5);
  ctx.fillStyle = "#9fcb74";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth * healthRatio, 5);

  ctx.restore();
}

function drawExperienceOrbs() {
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
}

function drawEffects() {
  for (const effect of gameState.effects) {
    const alpha = clamp(effect.life / effect.maxLife, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;

    if (effect.type === "fade") {
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius + (1 - alpha) * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (effect.type === "particle") {
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
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

  drawExperienceOrbs();
  drawEffects();
  drawPlayer(gameState.player);
}

function updateJoystickFromPointer(clientX, clientY) {
  const baseRect = joystickBase.getBoundingClientRect();
  const centerX = baseRect.left + baseRect.width / 2;
  const centerY = baseRect.top + baseRect.height / 2;
  const rawX = clientX - centerX;
  const rawY = clientY - centerY;
  const distance = Math.hypot(rawX, rawY);
  const limitedDistance = Math.min(distance, CONFIG.joystickMaxDistance);
  const angle = Math.atan2(rawY, rawX);
  const thumbX = Math.cos(angle) * limitedDistance;
  const thumbY = Math.sin(angle) * limitedDistance;

  // 搖桿輸出標準化成 -1 到 1，直接給既有移動更新流程使用。
  input.joystickX = distance === 0 ? 0 : thumbX / CONFIG.joystickMaxDistance;
  input.joystickY = distance === 0 ? 0 : thumbY / CONFIG.joystickMaxDistance;
  joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;
}

function releaseJoystick() {
  input.joystickX = 0;
  input.joystickY = 0;
  touchState.joystickPointerId = null;
  joystickThumb.style.transform = "translate(-50%, -50%)";
}

function setupTouchControls() {
  // 使用 pointer events 可以同時涵蓋手機觸控與部分平板裝置。
  joystickArea.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (touchState.joystickPointerId !== null) {
      return;
    }

    touchState.joystickPointerId = event.pointerId;
    joystickArea.setPointerCapture(event.pointerId);
    updateJoystickFromPointer(event.clientX, event.clientY);
  });

  joystickArea.addEventListener("pointermove", (event) => {
    if (touchState.joystickPointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    updateJoystickFromPointer(event.clientX, event.clientY);
  });

  const endJoystickPointer = (event) => {
    if (touchState.joystickPointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    releaseJoystick();
  };

  joystickArea.addEventListener("pointerup", endJoystickPointer);
  joystickArea.addEventListener("pointercancel", endJoystickPointer);
  joystickArea.addEventListener("lostpointercapture", () => {
    releaseJoystick();
  });

  // 攻擊鍵只負責觸發攻擊，不改動桌機 Space 鍵流程。
  attackButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    touchState.attackPointerId = event.pointerId;
    attackButton.classList.add("is-pressed");
    performAttack();
    updateHud();
  });

  const releaseAttackButton = (event) => {
    if (touchState.attackPointerId !== null && event.pointerId !== touchState.attackPointerId) {
      return;
    }

    event.preventDefault();
    touchState.attackPointerId = null;
    attackButton.classList.remove("is-pressed");
  };

  attackButton.addEventListener("pointerup", releaseAttackButton);
  attackButton.addEventListener("pointercancel", releaseAttackButton);

  // 防止行動裝置在遊戲區域內滾動頁面或觸發瀏覽器手勢。
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

  if (gameState?.isLevelUpPaused && event.code !== "Space") {
    setMovementKey(event.code, false);
    return;
  }

  setMovementKey(event.code, true);

  if (event.code === "Space" && !event.repeat) {
    performAttack();
    updateHud();
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

function updateQrDownloadLink() {
  if (!qrCanvas || !downloadQrLink) {
    return;
  }

  downloadQrLink.href = qrCanvas.toDataURL("image/png");
  downloadQrLink.classList.remove("hidden");
}

// Keep QR generation fully in the browser so GitHub Pages deployment stays static.
function renderQrCode(value) {
  if (!qrCanvas || !qrStatus) {
    return;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    qrStatus.textContent = "Please paste a URL before generating a QR Code.";
    downloadQrLink?.classList.add("hidden");
    return;
  }

  if (!window.QRious) {
    qrStatus.textContent = "QR library failed to load. Check your network and try again.";
    downloadQrLink?.classList.add("hidden");
    return;
  }

  if (!qrInstance) {
    qrInstance = new window.QRious({
      element: qrCanvas,
      value: trimmedValue,
      size: 240,
      background: "white",
      foreground: "black",
      level: "M",
      padding: 16,
    });
  } else {
    qrInstance.value = trimmedValue;
  }

  qrStatus.textContent = `QR Code ready for: ${trimmedValue}`;
  updateQrDownloadLink();
}

function initQrGenerator() {
  if (!qrUrlInput || !generateQrButton || !qrCanvas) {
    return;
  }

  generateQrButton.addEventListener("click", () => {
    renderQrCode(qrUrlInput.value);
  });

  qrUrlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renderQrCode(qrUrlInput.value);
    }
  });

  renderQrCode(qrUrlInput.value);
}

function init() {
  resetGame();
  setupTouchControls();
  initQrGenerator();
  window.cancelAnimationFrame(animationFrameId);
  animationFrameId = window.requestAnimationFrame(gameLoop);
}

init();
