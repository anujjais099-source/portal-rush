'use strict';
/**
 * PORTAL RUSH - persistence layer.
 *
 * A dependency-free, file-backed JSON database. No native bindings are
 * required (sqlite3/better-sqlite3 need a compiler toolchain on Windows,
 * which would break "playable immediately after installation"), so player
 * profiles and the global leaderboard are stored as JSON documents on disk
 * with an in-memory cache and a serialized write queue per file to prevent
 * concurrent writes from corrupting the file.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const MAX_LEADERBOARD_ENTRIES = 200;
const STARTING_COINS = 0;
const DEFAULT_UNLOCKED_CHARACTERS = ['doctor'];
const DAY_MS = 24 * 60 * 60 * 1000;
const XP_PER_LEVEL = 1000;

/** Fixed daily-quest roster (resets every calendar day per player). */
const QUEST_DEFS = [
  { id: 'run-2000', name: 'Run 2000 meters', statKey: 'distance', target: 2000, reward: 500 },
  { id: 'collect-100-coins', name: 'Collect 100 coins', statKey: 'coins', target: 100, reward: 300 },
  { id: 'use-powerup-3', name: 'Use powerup 3 times', statKey: 'powerups', target: 3, reward: 250 },
];

/** The single headline "Daily Challenge" shown on the home page — bigger goal, XP reward instead of coins. */
const CHALLENGE_DEF = { id: 'daily-challenge-5000', name: 'Run 5000m in any world', statKey: 'distance', target: 5000, rewardXp: 250 };

/** Fixed, permanent achievement roster (lifetime cumulative stats). */
const ACHIEVEMENT_DEFS = [
  { id: 'first-run', name: 'First Run', description: 'Complete your first run', statKey: 'totalRuns', target: 1 },
  { id: 'coin-collector', name: 'Coin Collector', description: 'Collect 1000 coins', statKey: 'totalCoinsEarned', target: 1000 },
  { id: 'portal-master', name: 'Portal Master', description: 'Use 10 portals', statKey: 'totalPortalsUsed', target: 10 },
  { id: 'key-master', name: 'Key Master', description: 'Collect 20 keys', statKey: 'totalKeysCollected', target: 20 },
  { id: 'box-opener', name: 'Box Opener', description: 'Open 5 mystery boxes', statKey: 'totalMysteryBoxesOpened', target: 5 },
];

function levelForXp(xp) {
  return 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (server-local UTC day)
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PLAYERS_FILE)) fs.writeFileSync(PLAYERS_FILE, '{}');
  if (!fs.existsSync(LEADERBOARD_FILE)) fs.writeFileSync(LEADERBOARD_FILE, '[]');
}
ensureDataFiles();

/** Serializes reads/writes to a JSON file so concurrent requests can't interleave writes. */
class JsonStore {
  constructor(filePath, fallback) {
    this.filePath = filePath;
    this.fallback = fallback;
    this.queue = Promise.resolve();
    this.cache = null;
  }

  async read() {
    if (this.cache !== null) return this.cache;
    try {
      const raw = await fsp.readFile(this.filePath, 'utf8');
      this.cache = JSON.parse(raw);
    } catch (err) {
      this.cache = typeof this.fallback === 'function' ? this.fallback() : this.fallback;
    }
    return this.cache;
  }

  /** mutator receives the current value and returns the next value. */
  async update(mutator) {
    this.queue = this.queue.then(async () => {
      const current = await this.read();
      const next = await mutator(current);
      this.cache = next;
      const tmp = `${this.filePath}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
      await fsp.rename(tmp, this.filePath);
      return next;
    });
    return this.queue;
  }
}

const playersStore = new JsonStore(PLAYERS_FILE, () => ({}));
const leaderboardStore = new JsonStore(LEADERBOARD_FILE, () => []);

function makePlayerId() {
  return crypto.randomBytes(9).toString('base64url');
}

function newProfile(name) {
  return {
    id: makePlayerId(),
    name: (name || 'Runner').slice(0, 16),
    coins: STARTING_COINS,
    gems: 0,
    stars: 0,
    xp: 0,
    level: 1,
    totalDistance: 0,
    totalRuns: 0,
    totalCoinsEarned: 0,
    totalPortalsUsed: 0,
    totalPowerupsUsed: 0,
    totalKeysCollected: 0,
    totalMysteryBoxesOpened: 0,
    bestScore: 0,
    bestDistance: 0,
    unlockedCharacters: [...DEFAULT_UNLOCKED_CHARACTERS],
    selectedCharacter: 'doctor',
    selectedWorld: 'day-mode',
    unlockedAchievements: [],
    dailyQuestDate: todayKey(),
    dailyProgress: { distance: 0, coins: 0, powerups: 0 },
    dailyClaimed: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Rolls a player's daily quest progress over to a fresh day if the calendar date has changed. */
function ensureFreshDay(p) {
  const today = todayKey();
  if (p.dailyQuestDate !== today) {
    p.dailyQuestDate = today;
    p.dailyProgress = { distance: 0, coins: 0, powerups: 0 };
    p.dailyClaimed = [];
  }
}

/** Backfills fields for profiles created before a feature was added. */
function migrateProfile(p) {
  if (p.stars === undefined) p.stars = 0;
  if (p.gems === undefined) p.gems = 0;
  if (p.xp === undefined) p.xp = 0;
  if (p.level === undefined) p.level = levelForXp(p.xp);
  if (p.totalCoinsEarned === undefined) p.totalCoinsEarned = p.coins || 0;
  if (p.totalPortalsUsed === undefined) p.totalPortalsUsed = 0;
  if (p.totalPowerupsUsed === undefined) p.totalPowerupsUsed = 0;
  if (p.totalKeysCollected === undefined) p.totalKeysCollected = 0;
  if (p.totalMysteryBoxesOpened === undefined) p.totalMysteryBoxesOpened = 0;
  if (!p.unlockedAchievements) p.unlockedAchievements = [];
  if (!p.selectedWorld) p.selectedWorld = 'day-mode';
  if (!p.dailyQuestDate) p.dailyQuestDate = todayKey();
  if (!p.dailyProgress) p.dailyProgress = { distance: 0, coins: 0, powerups: 0 };
  if (!p.dailyClaimed) p.dailyClaimed = [];
  ensureFreshDay(p);
  return p;
}

/** Applies newly-earned achievements/quest rewards; mutates `p` in place and returns what changed. */
function evaluateProgress(p) {
  const newlyUnlockedAchievements = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (p.unlockedAchievements.includes(def.id)) continue;
    if (p[def.statKey] >= def.target) {
      p.unlockedAchievements.push(def.id);
      p.stars += 1;
      newlyUnlockedAchievements.push(def.id);
    }
  }

  const newlyClaimedQuests = [];
  for (const def of QUEST_DEFS) {
    if (p.dailyClaimed.includes(def.id)) continue;
    if (p.dailyProgress[def.statKey] >= def.target) {
      p.dailyClaimed.push(def.id);
      p.coins += def.reward;
      p.totalCoinsEarned += def.reward;
      p.stars += 1;
      newlyClaimedQuests.push(def.id);
    }
  }

  let challengeCompleted = false;
  if (!p.dailyClaimed.includes(CHALLENGE_DEF.id) && p.dailyProgress[CHALLENGE_DEF.statKey] >= CHALLENGE_DEF.target) {
    p.dailyClaimed.push(CHALLENGE_DEF.id);
    p.xp += CHALLENGE_DEF.rewardXp;
    p.level = levelForXp(p.xp);
    p.stars += 1;
    challengeCompleted = true;
  }

  return { newlyUnlockedAchievements, newlyClaimedQuests, challengeCompleted };
}

async function getPlayer(id) {
  const players = await playersStore.read();
  const p = players[id];
  return p ? migrateProfile(p) : null;
}

async function createPlayer(name) {
  const profile = newProfile(name);
  await playersStore.update((players) => {
    players[profile.id] = profile;
    return players;
  });
  return profile;
}

async function renamePlayer(id, name) {
  let updated = null;
  await playersStore.update((players) => {
    if (!players[id]) return players;
    migrateProfile(players[id]);
    players[id].name = String(name || 'Runner').slice(0, 16);
    players[id].updatedAt = Date.now();
    updated = players[id];
    return players;
  });
  return updated;
}

async function selectCharacter(id, characterId) {
  let updated = null;
  await playersStore.update((players) => {
    const p = players[id];
    if (!p) return players;
    migrateProfile(p);
    if (!p.unlockedCharacters.includes(characterId)) return players;
    p.selectedCharacter = characterId;
    p.updatedAt = Date.now();
    updated = p;
    return players;
  });
  return updated;
}

async function selectWorld(id, worldId) {
  let updated = null;
  await playersStore.update((players) => {
    const p = players[id];
    if (!p) return players;
    migrateProfile(p);
    p.selectedWorld = worldId;
    p.updatedAt = Date.now();
    updated = p;
    return players;
  });
  return updated;
}

const GEM_TO_COIN_RATE = 20;

async function exchangeGems(id, gemCount) {
  let result = { ok: false, reason: 'not_found', profile: null };
  await playersStore.update((players) => {
    const p = players[id];
    if (!p) return players;
    migrateProfile(p);
    const count = Math.max(1, Math.floor(gemCount) || 1);
    if (p.gems < count) {
      result = { ok: false, reason: 'insufficient_gems', profile: p };
      return players;
    }
    p.gems -= count;
    p.coins += count * GEM_TO_COIN_RATE;
    p.totalCoinsEarned += count * GEM_TO_COIN_RATE;
    p.updatedAt = Date.now();
    result = { ok: true, reason: 'exchanged', profile: p };
    return players;
  });
  return result;
}

async function unlockCharacter(id, characterId, cost) {
  let result = { ok: false, reason: 'not_found', profile: null };
  await playersStore.update((players) => {
    const p = players[id];
    if (!p) return players;
    migrateProfile(p);
    if (p.unlockedCharacters.includes(characterId)) {
      result = { ok: true, reason: 'already_unlocked', profile: p };
      return players;
    }
    if (p.coins < cost) {
      result = { ok: false, reason: 'insufficient_coins', profile: p };
      return players;
    }
    p.coins -= cost;
    p.unlockedCharacters.push(characterId);
    p.updatedAt = Date.now();
    result = { ok: true, reason: 'unlocked', profile: p };
    return players;
  });
  return result;
}

/**
 * Records the results of a finished run: banks coins, updates bests/lifetime
 * stats, rolls daily-quest progress, unlocks any newly-earned achievements
 * or quest rewards, and appends to the leaderboard.
 */
async function saveRun(id, { score, distance, coinsCollected, worldName, portalsUsed, powerupsUsed, gemsCollected, keysCollected, mysteryBoxesOpened }) {
  let profile = null;
  let progressResult = { newlyUnlockedAchievements: [], newlyClaimedQuests: [] };
  let leveledUp = false;
  await playersStore.update((players) => {
    const p = players[id];
    if (!p) return players;
    migrateProfile(p);
    const levelBefore = p.level;

    const safeDistance = Math.max(0, distance | 0);
    const safeCoins = Math.max(0, coinsCollected | 0);
    const safeGems = Math.max(0, gemsCollected | 0);
    const safeKeys = Math.max(0, keysCollected | 0);
    const safeBoxes = Math.max(0, mysteryBoxesOpened | 0);
    const safePortals = Math.max(0, portalsUsed | 0);
    const safePowerups = Math.max(0, powerupsUsed | 0);

    p.coins += safeCoins;
    p.gems += safeGems;
    p.totalCoinsEarned += safeCoins;
    p.totalDistance += safeDistance;
    p.totalRuns += 1;
    p.totalPortalsUsed += safePortals;
    p.totalPowerupsUsed += safePowerups;
    p.totalKeysCollected += safeKeys;
    p.totalMysteryBoxesOpened += safeBoxes;
    p.bestScore = Math.max(p.bestScore, score | 0);
    p.bestDistance = Math.max(p.bestDistance, safeDistance);

    p.dailyProgress.distance += safeDistance;
    p.dailyProgress.coins += safeCoins;
    p.dailyProgress.powerups += safePowerups;

    const xpEarned = Math.floor(safeDistance / 10) + safeCoins * 2 + safeGems * 10;
    p.xp += xpEarned;
    p.level = levelForXp(p.xp);

    progressResult = evaluateProgress(p);
    leveledUp = p.level > levelBefore;
    p.updatedAt = Date.now();
    profile = p;
    return players;
  });

  if (!profile) return { profile: null, leveledUp: false, ...progressResult };

  await leaderboardStore.update((board) => {
    board.push({
      playerId: id,
      name: profile.name,
      score: score | 0,
      distance: distance | 0,
      world: worldName || 'Unknown',
      at: Date.now(),
    });
    board.sort((a, b) => b.score - a.score);
    return board.slice(0, MAX_LEADERBOARD_ENTRIES);
  });

  return { profile, leveledUp, ...progressResult };
}

async function getLeaderboard(limit = 10, range = 'all') {
  const board = await leaderboardStore.read();
  const cutoff = range === 'daily' ? Date.now() - DAY_MS : range === 'weekly' ? Date.now() - 7 * DAY_MS : 0;
  const filtered = cutoff ? board.filter((e) => e.at >= cutoff) : board;
  return filtered.slice(0, limit);
}

/** Returns each quest/achievement definition merged with this player's live progress. */
async function getQuestsAndAchievements(id) {
  const p = await getPlayer(id);
  if (!p) return null;
  return {
    quests: QUEST_DEFS.map((def) => ({
      ...def,
      progress: Math.min(def.target, p.dailyProgress[def.statKey] || 0),
      claimed: p.dailyClaimed.includes(def.id),
    })),
    achievements: ACHIEVEMENT_DEFS.map((def) => ({
      ...def,
      progress: Math.min(def.target, p[def.statKey] || 0),
      unlocked: p.unlockedAchievements.includes(def.id),
    })),
    dailyChallenge: {
      ...CHALLENGE_DEF,
      progress: Math.min(CHALLENGE_DEF.target, p.dailyProgress[CHALLENGE_DEF.statKey] || 0),
      claimed: p.dailyClaimed.includes(CHALLENGE_DEF.id),
    },
  };
}

module.exports = {
  getPlayer,
  createPlayer,
  renamePlayer,
  selectCharacter,
  selectWorld,
  unlockCharacter,
  exchangeGems,
  saveRun,
  getLeaderboard,
  getQuestsAndAchievements,
  QUEST_DEFS,
  ACHIEVEMENT_DEFS,
  CHALLENGE_DEF,
};
