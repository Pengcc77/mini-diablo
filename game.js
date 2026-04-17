const BASE_ASPECT_RATIO = 16 / 9;
const MOBILE_ASPECT_RATIO = 0.95;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const arenaFrame = document.getElementById("arenaFrame");
const joystickArea = document.getElementById("joystickArea");
const joystickBase = document.getElementById("joystickBase");
const joystickThumb = document.getElementById("joystickThumb");
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
const finalBuild = document.getElementById("finalBuild");
const finalUpgrades = document.getElementById("finalUpgrades");
const gameOverPanel = document.getElementById("gameOverPanel");
const levelUpPanel = document.getElementById("levelUpPanel");
const upgradeOptions = document.getElementById("upgradeOptions");
const restartButton = document.getElementById("restartButton");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
};

const BALANCE = {
  // Core progression and combat pacing values are centralized here for fast tuning.
  progression: {
    xpFirst: 14,
    xpSecond: 19,
    xpBase: 24,
    xpGrowth: 1.3,
  },
  upgrades: {
    attackDamageMult: 1.2,
    attackCooldownMult: 0.85,
    attackRangeMult: 1.15,
    maxHealthFlat: 25,
    moveSpeedMult: 1.1,
    regenFlat: 2,
    knockbackMult: 1.25,
    critChanceFlat: 0.08,
    pierceFlat: 1,
    xpMagnetMult: 1.25,
    lifestealFlat: 0.02,
    critChanceCap: 0.45,
    lifestealCap: 0.06,
  },
  elite: {
    baseHealthMult: 1.12,
    baseScoreMult: 2.0,
    baseXpMult: 1.8,
    radiusMult: 1.12,
    rageSpeedMult: 1.28,
    rageDamageMult: 1.15,
    armorHealthMult: 1.35,
    leechRatio: 0.24,
  },
  boss: {
    interval: 65,
    baseHealth: 320,
    healthScalePerMinute: 0.11,
    baseSpeed: 66,
    speedPerMinute: 3,
    baseDamage: 18,
    damagePerMinute: 1.5,
    baseScore: 240,
    scorePerMinute: 44,
    baseXp: 150,
    xpPerMinute: 30,
    skillCooldown: 5.2,
    summonCooldown: 9.6,
    killXpMultiplier: 2.1,
    killHeal: 42,
    bonusLevelUpsOnKill: 1,
  },
  spawn: {
    // Three-stage smooth curve. User feedback: current speed is too fast.
    earlyEnd: 35,
    midEnd: 100,
    lateRampDuration: 180,
    early: {
      intervalStart: 2.0,
      intervalEnd: 1.62,
      weights: { normal: 0.97, swift: 0.03, tank: 0 },
      extraSpawnStart: 0,
      extraSpawnEnd: 0.04,
      eliteStart: 0.006,
      eliteEnd: 0.018,
    },
    mid: {
      intervalStart: 1.56,
      intervalEnd: 1.22,
      weightsStart: { normal: 0.85, swift: 0.13, tank: 0.02 },
      weightsEnd: { normal: 0.7, swift: 0.22, tank: 0.08 },
      extraSpawnStart: 0.06,
      extraSpawnEnd: 0.15,
      eliteStart: 0.022,
      eliteEnd: 0.05,
    },
    late: {
      intervalStart: 1.2,
      intervalEnd: 0.94,
      weightsStart: { normal: 0.62, swift: 0.24, tank: 0.14 },
      weightsEnd: { normal: 0.53, swift: 0.28, tank: 0.19 },
      extraSpawnStart: 0.17,
      extraSpawnEnd: 0.29,
      eliteStart: 0.055,
      eliteEnd: 0.1,
    },
    maxEnemiesBase: 16,
    maxEnemiesPerMinute: 2,
    maxEnemiesCap: 34,
    safeDistance: 210,
  },
  drops: {
    healBaseChanceNormal: 0.05,
    healBaseChanceElite: 0.11,
    lowHpBonusScale: 0.6,
    healNormal: 16,
    healElite: 22,
  },
  debug: {
    // Toggle debug with F3.
    defaultEnabled: false,
  },
};
const DEBUG_QUERY_ENABLED =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

const CONFIG = {
  basePlayerSpeed: 240,
  baseAttackDamage: 16,
  baseAttackCooldown: 0.75,
  attackCooldownFloor: 0.26,
  attackDuration: 0.16,
  baseAttackRange: 80,
  attackArc: Math.PI * 0.82,
  baseKnockbackForce: 150,
  baseCritChance: 0,
  baseCritMultiplier: 1.8,
  basePierce: 1,
  baseXpMagnetRadius: 130,
  enemyHitFlashDuration: 0.15,
  playerInvulnerabilityDuration: 1.25,
  openingProtectionDuration: 4.2,
  deathFadeDuration: 0.36,
  particleDuration: 0.3,
  xpOrbLife: 14,
  healOrbLife: 12,
  pickupRadius: 24,
  orbSpeed: 240,
  dashDistance: 108,
  dashCooldown: 3.2,
  dashInvulnerability: 0.35,
  spawnSafeDistance: BALANCE.spawn.safeDistance,
  joystickMaxDistance: 34,
  bossInterval: BALANCE.boss.interval,
};

const ENEMY_TYPES = {
  normal: {
    id: "normal",
    radius: 14,
    maxHealth: 36,
    speed: 80,
    damage: 7,
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
    damage: 5,
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
    damage: 11,
    score: 24,
    xp: 15,
    color: "#5e2d8c",
    hitColor: "#d39cff",
  },
};

// Elite affixes add combat variety and should be easy to expand later.
const ELITE_AFFIXES = {
  rage: {
    id: "rage",
    name: "狂暴",
    apply(enemy) {
      enemy.speed *= BALANCE.elite.rageSpeedMult;
      enemy.damage *= BALANCE.elite.rageDamageMult;
      enemy.color = "#cc4d28";
    },
  },
  armor: {
    id: "armor",
    name: "厚甲",
    apply(enemy) {
      enemy.maxHealth *= BALANCE.elite.armorHealthMult;
      enemy.health = enemy.maxHealth;
      enemy.color = "#4f6aa3";
    },
  },
  burst: {
    id: "burst",
    name: "爆裂",
    apply(enemy) {
      enemy.onDeathBurst = true;
      enemy.color = "#c95d38";
    },
  },
  leech: {
    id: "leech",
    name: "吸血",
    apply(enemy) {
      enemy.lifeStealRatio = BALANCE.elite.leechRatio;
      enemy.color = "#8f355f";
    },
  },
};

const ELITE_AFFIX_LABELS = {
  rage: "狂暴",
  armor: "厚甲",
  burst: "爆裂",
  leech: "吸血",
};

function createUpgradeDefinitions() {
  // Display text and actual effect are bound in one place to avoid mismatch.
  return {
    attackDamage: {
      id: "attackDamage",
      category: "base",
      title: "攻擊強化",
      description: "攻擊傷害 +20%",
      summary: "攻擊傷害",
      apply(player) {
        player.stats.attackDamageMultiplier *= BALANCE.upgrades.attackDamageMult;
      },
      buildTag: "damage",
    },
    attackCooldown: {
      id: "attackCooldown",
      category: "base",
      title: "攻速提升",
      description: "攻擊間隔 -15%",
      summary: "攻擊速度",
      apply(player) {
        player.stats.attackCooldownMultiplier *= BALANCE.upgrades.attackCooldownMult;
      },
      buildTag: "speed",
    },
    attackRange: {
      id: "attackRange",
      category: "base",
      title: "攻擊範圍提升",
      description: "攻擊距離 +15%",
      summary: "攻擊範圍",
      apply(player) {
        player.stats.attackRangeMultiplier *= BALANCE.upgrades.attackRangeMult;
      },
      buildTag: "control",
    },
    maxHealth: {
      id: "maxHealth",
      category: "base",
      title: "生命上限提升",
      description: "最大生命 +25",
      summary: "生命上限",
      apply(player) {
        player.maxHealth += BALANCE.upgrades.maxHealthFlat;
        player.health = Math.min(player.maxHealth, player.health + BALANCE.upgrades.maxHealthFlat);
      },
      buildTag: "tank",
    },
    moveSpeed: {
      id: "moveSpeed",
      category: "base",
      title: "移動速度提升",
      description: "移動速度 +10%",
      summary: "移動速度",
      apply(player) {
        player.stats.moveSpeedMultiplier *= BALANCE.upgrades.moveSpeedMult;
      },
      buildTag: "speed",
    },
    regen: {
      id: "regen",
      category: "base",
      title: "自動回血",
      description: "每秒恢復 2 點生命",
      summary: "自動回血",
      apply(player) {
        player.stats.regenPerSec += BALANCE.upgrades.regenFlat;
      },
      buildTag: "sustain",
    },
    knockback: {
      id: "knockback",
      category: "base",
      title: "擊退強化",
      description: "擊退距離 +25%",
      summary: "擊退強化",
      apply(player) {
        player.stats.knockbackMultiplier *= BALANCE.upgrades.knockbackMult;
      },
      buildTag: "control",
    },
    crit: {
      id: "crit",
      category: "special",
      title: "暴擊強化",
      description: "暴擊率 +8%",
      summary: "暴擊率",
      apply(player) {
        player.stats.critChance = Math.min(
          BALANCE.upgrades.critChanceCap,
          player.stats.critChance + BALANCE.upgrades.critChanceFlat
        );
      },
      buildTag: "damage",
    },
    pierce: {
      id: "pierce",
      category: "special",
      title: "穿透攻擊",
      description: "可額外命中 +1",
      summary: "穿透命中",
      apply(player) {
        player.stats.pierce += BALANCE.upgrades.pierceFlat;
      },
      buildTag: "damage",
    },
    xpMagnet: {
      id: "xpMagnet",
      category: "special",
      title: "經驗吸附",
      description: "吸收範圍 +25%",
      summary: "吸附範圍",
      apply(player) {
        player.stats.xpMagnetMultiplier *= BALANCE.upgrades.xpMagnetMult;
      },
      buildTag: "utility",
    },
    lifesteal: {
      id: "lifesteal",
      category: "special",
      title: "吸血打擊",
      description: "命中吸血 +2%",
      summary: "命中吸血",
      apply(player) {
        player.stats.lifesteal = Math.min(
          BALANCE.upgrades.lifestealCap,
          player.stats.lifesteal + BALANCE.upgrades.lifestealFlat
        );
      },
      buildTag: "sustain",
    },
  };
}

const UPGRADE_DEFINITIONS = createUpgradeDefinitions();

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
  joystickTouchId: null,
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
  if (elapsed < BALANCE.spawn.earlyEnd) return "Phase 1";
  if (elapsed < BALANCE.spawn.midEnd) return "Phase 2";
  return "Phase 3+";
}

function getXpRequirement(level) {
  if (level <= 1) return BALANCE.progression.xpFirst;
  if (level === 2) return BALANCE.progression.xpSecond;
  return Math.floor(
    BALANCE.progression.xpBase * Math.pow(BALANCE.progression.xpGrowth, level - 3)
  );
}

function getBuildSummaryTags(buildCounters) {
  const candidates = [
    { key: "speed", name: "高攻速流" },
    { key: "tank", name: "高生命流" },
    { key: "control", name: "擊退控制流" },
    { key: "sustain", name: "吸血生存流" },
    { key: "damage", name: "暴擊輸出流" },
    { key: "utility", name: "成長吸附流" },
  ];
  let best = candidates[0];
  let bestValue = -1;

  for (const option of candidates) {
    const value = buildCounters[option.key] || 0;
    if (value > bestValue) {
      best = option;
      bestValue = value;
    }
  }

  if (bestValue <= 0) return "平衡流";
  return best.name;
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
      attackDamageMultiplier: 1,
      attackCooldownMultiplier: 1,
      attackRangeMultiplier: 1,
      moveSpeedMultiplier: 1,
      regenPerSec: 0,
      knockbackMultiplier: 1,
      critChance: CONFIG.baseCritChance,
      critMultiplier: CONFIG.baseCritMultiplier,
      pierce: CONFIG.basePierce,
      xpMagnetMultiplier: 1,
      lifesteal: 0,
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
    nextBossTime: BALANCE.boss.interval,
    isGameOver: false,
    isLevelUpPaused: false,
    pendingLevelUps: 0,
    currentUpgradeOptions: [],
    upgradeHistory: [],
    buildCounters: {
      damage: 0,
      speed: 0,
      control: 0,
      tank: 0,
      sustain: 0,
      utility: 0,
    },
    debugEnabled: BALANCE.debug.defaultEnabled || DEBUG_QUERY_ENABLED,
  };
}

function getPlayerMoveSpeed() {
  return CONFIG.basePlayerSpeed * gameState.player.stats.moveSpeedMultiplier;
}

function getPlayerAttackDamage() {
  return CONFIG.baseAttackDamage * gameState.player.stats.attackDamageMultiplier;
}

function getPlayerAttackCooldown() {
  return Math.max(
    CONFIG.attackCooldownFloor,
    CONFIG.baseAttackCooldown * gameState.player.stats.attackCooldownMultiplier
  );
}

function getPlayerAttackRange() {
  return CONFIG.baseAttackRange * gameState.player.stats.attackRangeMultiplier;
}

function getPlayerXpMagnetRadius() {
  return CONFIG.baseXpMagnetRadius * gameState.player.stats.xpMagnetMultiplier;
}

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
    isElite: false,
    eliteAffix: null,
    onDeathBurst: false,
    lifeStealRatio: 0,
    isBoss: false,
    bossSkillCooldown: 0,
    bossSummonCooldown: 0,
  };
}

function applyEliteAffix(enemy, affixId) {
  const affix = ELITE_AFFIXES[affixId];
  if (!affix) return;

  affix.apply(enemy);
  enemy.isElite = true;
  enemy.eliteAffix = affixId;
  enemy.maxHealth *= BALANCE.elite.baseHealthMult;
  enemy.health = enemy.maxHealth;
  enemy.score *= BALANCE.elite.baseScoreMult;
  enemy.xp *= BALANCE.elite.baseXpMult;
  enemy.radius *= BALANCE.elite.radiusMult;
}

function createBoss(x, y) {
  const elapsedMinutes = Math.floor(gameState.elapsedTime / 60);
  const scale = 1 + elapsedMinutes * BALANCE.boss.healthScalePerMinute;
  const boss = createEnemy("tank", x, y);
  boss.isBoss = true;
  boss.radius = 30;
  boss.maxHealth = BALANCE.boss.baseHealth * scale;
  boss.health = boss.maxHealth;
  boss.speed = BALANCE.boss.baseSpeed + elapsedMinutes * BALANCE.boss.speedPerMinute;
  boss.damage = BALANCE.boss.baseDamage + elapsedMinutes * BALANCE.boss.damagePerMinute;
  boss.score = BALANCE.boss.baseScore + elapsedMinutes * BALANCE.boss.scorePerMinute;
  boss.xp = BALANCE.boss.baseXp + elapsedMinutes * BALANCE.boss.xpPerMinute;
  boss.color = "#862f1f";
  boss.hitColor = "#f38b62";
  boss.bossSkillCooldown = BALANCE.boss.skillCooldown;
  boss.bossSummonCooldown = BALANCE.boss.summonCooldown;
  return boss;
}

function getEnemyTitle(enemy) {
  if (enemy.isBoss) return "首領";
  if (!enemy.isElite) return "";
  const affixLabel = ELITE_AFFIX_LABELS[enemy.eliteAffix] || "精英";
  return `精英・${affixLabel}`;
}

function getSpawnProfile(elapsed) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpWeights = (start, end, t) => ({
    normal: lerp(start.normal, end.normal, t),
    swift: lerp(start.swift, end.swift, t),
    tank: lerp(start.tank, end.tank, t),
  });

  if (elapsed < BALANCE.spawn.earlyEnd) {
    const t = elapsed / BALANCE.spawn.earlyEnd;
    const early = BALANCE.spawn.early;
    return {
      interval: lerp(early.intervalStart, early.intervalEnd, t),
      weights: early.weights,
      extraSpawnChance: lerp(early.extraSpawnStart, early.extraSpawnEnd, t),
      eliteChance: lerp(early.eliteStart, early.eliteEnd, t),
    };
  }

  if (elapsed < BALANCE.spawn.midEnd) {
    const mid = BALANCE.spawn.mid;
    const t = (elapsed - BALANCE.spawn.earlyEnd) / (BALANCE.spawn.midEnd - BALANCE.spawn.earlyEnd);
    return {
      interval: lerp(mid.intervalStart, mid.intervalEnd, t),
      weights: lerpWeights(mid.weightsStart, mid.weightsEnd, t),
      extraSpawnChance: lerp(mid.extraSpawnStart, mid.extraSpawnEnd, t),
      eliteChance: lerp(mid.eliteStart, mid.eliteEnd, t),
    };
  }

  const late = BALANCE.spawn.late;
  const t = Math.min(1, (elapsed - BALANCE.spawn.midEnd) / BALANCE.spawn.lateRampDuration);
  return {
    interval: lerp(late.intervalStart, late.intervalEnd, t),
    weights: lerpWeights(late.weightsStart, late.weightsEnd, t),
    extraSpawnChance: lerp(late.extraSpawnStart, late.extraSpawnEnd, t),
    eliteChance: lerp(late.eliteStart, late.eliteEnd, t),
  };
}

function getEnemySpawnLimit() {
  const minutes = gameState.elapsedTime / 60;
  return Math.min(
    BALANCE.spawn.maxEnemiesCap,
    Math.floor(BALANCE.spawn.maxEnemiesBase + minutes * BALANCE.spawn.maxEnemiesPerMinute)
  );
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
  let x = 0;
  let y = 0;

  for (let i = 0; i < 18; i += 1) {
    const side = Math.floor(Math.random() * 4);
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

function spawnEnemy(isForcedType = null) {
  const typeId = isForcedType || chooseEnemyType(gameState.elapsedTime);
  const pos = findSafeSpawnPosition();
  const enemy = createEnemy(typeId, pos.x, pos.y);
  const profile = getSpawnProfile(gameState.elapsedTime);

  if (!enemy.isBoss && Math.random() < profile.eliteChance) {
    const affixes = Object.keys(ELITE_AFFIXES);
    const affixId = affixes[Math.floor(Math.random() * affixes.length)];
    applyEliteAffix(enemy, affixId);
  }

  gameState.enemies.push(enemy);
}

function spawnBossIfNeeded() {
  if (gameState.elapsedTime < gameState.nextBossTime) return;
  const hasBossAlive = gameState.enemies.some((enemy) => enemy.isBoss);
  if (hasBossAlive) return;

  const pos = findSafeSpawnPosition();
  gameState.enemies.push(createBoss(pos.x, pos.y));
  gameState.nextBossTime += BALANCE.boss.interval;
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

function spawnXpOrb(enemy, multiplier = 1) {
  gameState.xpOrbs.push({
    x: enemy.x,
    y: enemy.y,
    radius: clamp(enemy.radius * 0.44, 6, 10),
    value: enemy.xp * multiplier,
    life: CONFIG.xpOrbLife,
  });
}

function spawnHealOrb(enemy, healValue = 18) {
  gameState.healOrbs.push({
    x: enemy.x,
    y: enemy.y,
    radius: 7,
    heal: healValue,
    life: CONFIG.healOrbLife,
  });
}

function tryDropHealOrb(enemy) {
  const player = gameState.player;
  const hpRatio = player.health / player.maxHealth;
  const bonus = hpRatio < 0.5 ? (0.5 - hpRatio) * BALANCE.drops.lowHpBonusScale : 0;
  const baseChance = enemy.isElite ? BALANCE.drops.healBaseChanceElite : BALANCE.drops.healBaseChanceNormal;
  const dropChance = baseChance + bonus;

  if (Math.random() < dropChance) {
    spawnHealOrb(enemy, enemy.isElite ? BALANCE.drops.healElite : BALANCE.drops.healNormal);
  }
}

function onEnemyKilled(enemy) {
  gameState.kills += 1;
  gameState.score += enemy.score;
  spawnDeathEffect(enemy);
  spawnXpOrb(enemy);
  tryDropHealOrb(enemy);

  if (enemy.onDeathBurst) {
    gameState.effects.push({
      type: "shockwave",
      x: enemy.x,
      y: enemy.y,
      radius: 110,
      life: 0.18,
      maxLife: 0.18,
      color: "#ff9675",
    });

    const player = gameState.player;
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < 110 && player.damageCooldownTimer <= 0) {
      player.health = Math.max(0, player.health - 9);
      player.damageCooldownTimer = CONFIG.playerInvulnerabilityDuration;
    }
  }

  if (enemy.isBoss) {
    spawnXpOrb(enemy, BALANCE.boss.killXpMultiplier);
    spawnHealOrb(enemy, BALANCE.boss.killHeal);
    gameState.pendingLevelUps += BALANCE.boss.bonusLevelUpsOnKill;
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
  joystickThumb.style.transform = "translate(-50%, -50%)";
  touchState.joystickPointerId = null;
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

function getMoveSpeed() {
  return CONFIG.basePlayerSpeed * gameState.player.stats.moveSpeedMultiplier;
}

function getAttackDamage() {
  return CONFIG.baseAttackDamage * gameState.player.stats.attackDamageMultiplier;
}

function getAttackCooldown() {
  return Math.max(
    CONFIG.attackCooldownFloor,
    CONFIG.baseAttackCooldown * gameState.player.stats.attackCooldownMultiplier
  );
}

function getAttackRange() {
  return CONFIG.baseAttackRange * gameState.player.stats.attackRangeMultiplier;
}

function getXpMagnetRadius() {
  return CONFIG.baseXpMagnetRadius * gameState.player.stats.xpMagnetMultiplier;
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

  player.x += moveX * getMoveSpeed() * deltaTime;
  player.y += moveY * getMoveSpeed() * deltaTime;
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

function runBossLogic(enemy, deltaTime) {
  if (!enemy.isBoss) return;

  enemy.bossSkillCooldown -= deltaTime;
  enemy.bossSummonCooldown -= deltaTime;

  if (enemy.bossSkillCooldown <= 0) {
    enemy.bossSkillCooldown = BALANCE.boss.skillCooldown;
    const player = gameState.player;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.knockbackX = (dx / len) * 340;
    enemy.knockbackY = (dy / len) * 340;

    gameState.effects.push({
      type: "shockwave",
      x: enemy.x,
      y: enemy.y,
      radius: 120,
      life: 0.24,
      maxLife: 0.24,
      color: "#f38b62",
    });
  }

  if (enemy.bossSummonCooldown <= 0) {
    enemy.bossSummonCooldown = BALANCE.boss.summonCooldown;
    spawnEnemy("normal");
    if (gameState.elapsedTime > BALANCE.spawn.midEnd) {
      spawnEnemy("swift");
    }
  }
}

// Keep player/enemy from overlapping into the same position.
// We only push the enemy out to preserve player control feel.
function resolvePlayerEnemyOverlap(player, enemy) {
  const minDistance = player.radius + enemy.radius;
  let dx = enemy.x - player.x;
  let dy = enemy.y - player.y;
  let dist = Math.hypot(dx, dy);

  if (dist >= minDistance) return;

  if (dist < 0.0001) {
    dx = enemy.knockbackX || player.moveX || 1;
    dy = enemy.knockbackY || player.moveY || 0;
    dist = Math.hypot(dx, dy) || 1;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const separation = minDistance - dist + 0.1;
  enemy.x += nx * separation;
  enemy.y += ny * separation;
  enemy.x = clamp(enemy.x, enemy.radius, WORLD.width - enemy.radius);
  enemy.y = clamp(enemy.y, enemy.radius, WORLD.height - enemy.radius);
}

function updateEnemies(deltaTime) {
  const player = gameState.player;

  for (const enemy of gameState.enemies) {
    runBossLogic(enemy, deltaTime);

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
    resolvePlayerEnemyOverlap(player, enemy);

    const touching = distanceBetween(enemy, player) < enemy.radius + player.radius;
    if (touching && player.damageCooldownTimer <= 0) {
      player.health = Math.max(0, player.health - enemy.damage);
      player.damageCooldownTimer = CONFIG.playerInvulnerabilityDuration;
      if (enemy.lifeStealRatio > 0) {
        enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.damage * enemy.lifeStealRatio);
      }
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
  const magnetRadius = getXpMagnetRadius();

  gameState.xpOrbs = gameState.xpOrbs.filter((orb) => {
    orb.life -= deltaTime;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < magnetRadius) {
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

    if (dist < magnetRadius * 0.84) {
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
  let entries = Object.values(UPGRADE_DEFINITIONS);
  const player = gameState.player;

  // Soft cap filtering keeps late-game choices meaningful and avoids runaway builds.
  if (player.stats.lifesteal >= BALANCE.upgrades.lifestealCap * 0.9) {
    entries = entries.filter((entry) => entry.id !== "lifesteal");
  }
  if (player.stats.critChance >= BALANCE.upgrades.critChanceCap * 0.9) {
    entries = entries.filter((entry) => entry.id !== "crit");
  }
  if (getAttackCooldown() <= CONFIG.attackCooldownFloor + 0.02) {
    entries = entries.filter((entry) => entry.id !== "attackCooldown");
  }

  const base = shuffleArray(entries.filter((entry) => entry.category === "base"));
  const special = shuffleArray(entries.filter((entry) => entry.category === "special"));

  // Always offer at least one special option after first minute to strengthen build identity.
  const picks = [];
  if (gameState.elapsedTime > 45 && special.length > 0) {
    picks.push(special.shift());
  }

  while (picks.length < count && base.length > 0) {
    picks.push(base.shift());
  }

  while (picks.length < count && special.length > 0) {
    picks.push(special.shift());
  }

  return shuffleArray(picks).slice(0, count);
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

  gameState.upgradeHistory.push(upgrade.summary);
  gameState.buildCounters[upgrade.buildTag] += 1;

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

// Auto attack logic:
// 1) lock nearest target
// 2) face target
// 3) attack when target is in range and cooldown finished
function updateAutoAttack() {
  const player = gameState.player;
  const { nearest, distance } = getNearestEnemy();
  if (!nearest) return;

  const dx = nearest.x - player.x;
  const dy = nearest.y - player.y;
  // When target overlaps player, fallback to current facing so attack direction stays stable.
  // This avoids zero-vector direction causing inconsistent near-zero angle checks.
  let faceX = dx;
  let faceY = dy;
  let len = Math.hypot(faceX, faceY);
  if (len < 0.0001) {
    faceX = player.moveX;
    faceY = player.moveY;
    len = Math.hypot(faceX, faceY);
    if (len < 0.0001) {
      faceX = 1;
      faceY = 0;
      len = 1;
    }
  }
  faceX /= len;
  faceY /= len;
  player.moveX = faceX;
  player.moveY = faceY;

  const attackRange = getAttackRange();
  if (player.attackCooldownTimer > 0) return;
  if (distance > attackRange + nearest.radius) return;

  player.attackTimer = CONFIG.attackDuration;
  player.attackCooldownTimer = getAttackCooldown();
  const attackAngle = Math.atan2(faceY, faceX);
  const critRoll = Math.random() < player.stats.critChance;
  const damageBase = getAttackDamage();
  const damage = critRoll ? damageBase * player.stats.critMultiplier : damageBase;
  let remainingHits = player.stats.pierce;
  let totalDealt = 0;

  // Sort by distance so piercing hits the closest enemies first.
  const sortedTargets = [...gameState.enemies].sort(
    (a, b) => distanceBetween(player, a) - distanceBetween(player, b)
  );

  const deadSet = new Set();
  for (const enemy of sortedTargets) {
    if (remainingHits <= 0) break;

    const ex = enemy.x - player.x;
    const ey = enemy.y - player.y;
    const dist = Math.hypot(ex, ey);
    if (dist > attackRange + enemy.radius) continue;

    // Important close-range fix:
    // If enemy overlaps player's body, always allow hit regardless of facing arc.
    // This prevents "touching but cannot hit" cases on mobile/auto-target edge conditions.
    const overlapDistance = player.radius + enemy.radius;
    const isOverlapping = dist <= overlapDistance;
    if (!isOverlapping) {
      const enemyAngle = Math.atan2(ey, ex);
      const delta = Math.atan2(Math.sin(enemyAngle - attackAngle), Math.cos(enemyAngle - attackAngle));
      if (Math.abs(delta) > CONFIG.attackArc / 2) continue;
    }

    enemy.health -= damage;
    totalDealt += damage;
    enemy.hitFlashTimer = CONFIG.enemyHitFlashDuration;
    const safe = dist || 1;
    const kb = CONFIG.baseKnockbackForce * player.stats.knockbackMultiplier;
    enemy.knockbackX = (ex / safe) * kb;
    enemy.knockbackY = (ey / safe) * kb;
    remainingHits -= 1;

    if (enemy.health <= 0) {
      deadSet.add(enemy);
    }
  }

  if (player.stats.lifesteal > 0 && totalDealt > 0) {
    player.health = Math.min(player.maxHealth, player.health + totalDealt * player.stats.lifesteal);
  }

  if (deadSet.size > 0) {
    gameState.enemies = gameState.enemies.filter((enemy) => {
      if (!deadSet.has(enemy)) return true;
      onEnemyKilled(enemy);
      return false;
    });
  }
}

function updateSpawning(deltaTime) {
  const profile = getSpawnProfile(gameState.elapsedTime);
  gameState.spawnTimer += deltaTime;
  const enemyLimit = getEnemySpawnLimit();

  while (gameState.spawnTimer >= profile.interval) {
    gameState.spawnTimer -= profile.interval;
    if (gameState.enemies.length >= enemyLimit) {
      continue;
    }
    spawnEnemy();
    if (Math.random() < profile.extraSpawnChance && gameState.enemies.length < enemyLimit) {
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
  spawnBossIfNeeded();
  updateHud();

  if (gameState.player.health <= 0) {
    gameState.isGameOver = true;
    finalLevel.textContent = `等級：${gameState.player.level}`;
    finalScore.textContent = `分數：${gameState.score}`;
    finalTime.textContent = `存活：${formatTime(gameState.elapsedTime)}`;
    finalKills.textContent = `擊殺：${gameState.kills}`;
    finalBuild.textContent = `流派：${getBuildSummaryTags(gameState.buildCounters)}`;
    const summary = gameState.upgradeHistory.slice(-5).join("、");
    finalUpgrades.textContent = `主要強化：${summary || "-"}`;
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
    const attackRange = getAttackRange();
    ctx.fillStyle = `rgba(239, 172, 77, ${0.12 + progress * 0.24})`;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(
      player.x,
      player.y,
      attackRange,
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

  if (enemy.isElite || enemy.isBoss) {
    ctx.strokeStyle = enemy.isBoss ? "#ffd26c" : "#9be2ff";
    ctx.lineWidth = enemy.isBoss ? 4 : 3;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  const barWidth = enemy.radius * 2.08;
  const ratio = clamp(enemy.health / enemy.maxHealth, 0, 1);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth, 5);
  ctx.fillStyle = enemy.isBoss ? "#ffd26c" : "#9fcb74";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth * ratio, 5);

  // Border enemies (elite/boss) show explicit title + HP for better kill feedback.
  if (enemy.isElite || enemy.isBoss) {
    const title = getEnemyTitle(enemy);
    const hpText = `${Math.max(0, Math.ceil(enemy.health))}/${Math.ceil(enemy.maxHealth)}`;
    const label = `${title}  ${hpText}`;
    const y = enemy.y - enemy.radius - 17;
    ctx.font = enemy.isBoss ? "bold 12px sans-serif" : "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(8, 10, 9, 0.62)";
    ctx.fillRect(enemy.x - labelWidth / 2 - 4, y - 13, labelWidth + 8, 14);
    ctx.fillStyle = enemy.isBoss ? "#ffe08a" : "#c5e9ff";
    ctx.fillText(label, enemy.x, y - 2);
  }
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
    } else if (fx.type === "shockwave") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * (1 - alpha * 0.35), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawDebugOverlay() {
  if (!gameState?.debugEnabled) return;

  const player = gameState.player;
  const bosses = gameState.enemies.filter((enemy) => enemy.isBoss);
  const elites = gameState.enemies.filter((enemy) => enemy.isElite && !enemy.isBoss);
  const eliteAffixCount = { rage: 0, armor: 0, burst: 0, leech: 0 };
  for (const elite of elites) {
    if (eliteAffixCount[elite.eliteAffix] !== undefined) {
      eliteAffixCount[elite.eliteAffix] += 1;
    }
  }

  const lines = [
    `DEBUG (F3)`,
    `Phase: ${getPhaseLabel(gameState.elapsedTime)}  Time: ${formatTime(gameState.elapsedTime)}`,
    `Enemies: ${gameState.enemies.length}/${getEnemySpawnLimit()}  SpawnInt: ${getSpawnProfile(gameState.elapsedTime).interval.toFixed(2)}s`,
    `ATK ${getAttackDamage().toFixed(1)}  CD ${getAttackCooldown().toFixed(2)}  RNG ${getAttackRange().toFixed(0)}`,
    `Move ${getMoveSpeed().toFixed(0)}  Regen ${player.stats.regenPerSec.toFixed(1)}  LS ${(player.stats.lifesteal * 100).toFixed(1)}%`,
    `Crit ${(player.stats.critChance * 100).toFixed(1)}%  Pierce ${player.stats.pierce}  KB x${player.stats.knockbackMultiplier.toFixed(2)}`,
    `Boss: ${bosses.length > 0 ? `${Math.ceil(bosses[0].health)}/${Math.ceil(bosses[0].maxHealth)}` : "none"}  NextBoss @ ${Math.ceil(gameState.nextBossTime)}s`,
    `Elite: ${elites.length} (狂暴 ${eliteAffixCount.rage}, 厚甲 ${eliteAffixCount.armor}, 爆裂 ${eliteAffixCount.burst}, 吸血 ${eliteAffixCount.leech})`,
  ];

  const x = 10;
  const y = 10;
  const lineHeight = 16;
  const width = 420;
  const height = lines.length * lineHeight + 12;
  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 7, 0.68)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(174, 223, 196, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#d8efe3";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x + 8, y + 6 + i * lineHeight);
  }
  ctx.restore();
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
  drawDebugOverlay();
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

// Touch fallback for mobile browsers/webviews where Pointer Events are limited.
function updateJoystickFromTouch(touch) {
  updateJoystickFromPointer(touch.clientX, touch.clientY);
}

function releaseJoystick() {
  input.joystickX = 0;
  input.joystickY = 0;
  touchState.joystickPointerId = null;
  touchState.joystickTouchId = null;
  joystickBase.classList.remove("is-active");
  joystickThumb.style.transform = "translate(-50%, -50%)";
}

function setupTouchControls() {
  if (!joystickArea || !joystickBase || !joystickThumb) return;

  joystickArea.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (touchState.joystickPointerId !== null) return;
    touchState.joystickPointerId = event.pointerId;
    joystickBase.classList.add("is-active");
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

  // iOS / embedded browser compatibility:
  // Always bind touch events as a fallback because some browsers expose PointerEvent
  // but still behave inconsistently for virtual joystick dragging.
  joystickArea.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      if (touchState.joystickTouchId !== null) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      touchState.joystickTouchId = touch.identifier;
      joystickBase.classList.add("is-active");
      updateJoystickFromTouch(touch);
    },
    { passive: false }
  );

  joystickArea.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      const tracked = Array.from(event.changedTouches).find(
        (t) => t.identifier === touchState.joystickTouchId
      );
      if (!tracked) return;
      updateJoystickFromTouch(tracked);
    },
    { passive: false }
  );

  joystickArea.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      const tracked = Array.from(event.changedTouches).some(
        (t) => t.identifier === touchState.joystickTouchId
      );
      if (!tracked) return;
      releaseJoystick();
    },
    { passive: false }
  );

  joystickArea.addEventListener(
    "touchcancel",
    (event) => {
      event.preventDefault();
      const tracked = Array.from(event.changedTouches).some(
        (t) => t.identifier === touchState.joystickTouchId
      );
      if (!tracked) return;
      releaseJoystick();
    },
    { passive: false }
  );

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
  if (event.code === "F3") {
    event.preventDefault();
    if (gameState) {
      gameState.debugEnabled = !gameState.debugEnabled;
    }
    return;
  }

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
