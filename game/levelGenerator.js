import { chunkRng } from './rng.js';

/**
 * Deterministic, chunk-based procedural level generator. Every chunk's
 * content is a pure function of (seed, chunkIndex, densityBucket), so two
 * clients racing on the same seed always see the same obstacle/coin/powerup
 * layout - the basis for fair, synced multiplayer racing without streaming
 * level data over the network.
 */

export const CHUNK_SIZE = 520;
const SAFE_CHUNKS = 2; // no obstacles for the first N chunks so a run always starts clean

// Each pattern places one or more obstacles (world-relative x within the chunk)
// with a documented required action, tuned to be fair at moderate scroll speeds.
const PATTERNS = [
  { id: 'low-single', density: 1, items: [{ dx: 260, kind: 'low', w: 42, h: 46, action: 'jump' }] },
  { id: 'wide-hop', density: 1, items: [{ dx: 260, kind: 'wide', w: 110, h: 46, action: 'jump' }] },
  { id: 'overhead-bar', density: 1, items: [{ dx: 260, kind: 'overhead', w: 90, h: 40, gap: 58, action: 'slide' }] },
  {
    id: 'double-hop', density: 2,
    items: [
      { dx: 220, kind: 'low', w: 40, h: 46, action: 'jump' },
      { dx: 340, kind: 'low', w: 40, h: 46, action: 'jump' },
    ],
  },
  {
    id: 'hop-then-duck', density: 2,
    items: [
      { dx: 200, kind: 'low', w: 42, h: 46, action: 'jump' },
      { dx: 360, kind: 'overhead', w: 90, h: 40, gap: 58, action: 'slide' },
    ],
  },
];

function placeCoinArc(chunkStart, centerDx, rng) {
  const coins = [];
  const count = rng.int(4, 6);
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 34;
    coins.push({
      x: chunkStart + centerDx + spread,
      heightAboveGround: 70 + Math.sin((i / (count - 1 || 1)) * Math.PI) * 55,
      collected: false,
    });
  }
  return coins;
}

function placeCoinLine(chunkStart, rng) {
  const coins = [];
  const count = rng.int(5, 8);
  const startDx = rng.range(60, 160);
  for (let i = 0; i < count; i++) {
    coins.push({
      x: chunkStart + startDx + i * 36,
      heightAboveGround: 34,
      collected: false,
    });
  }
  return coins;
}

const POWERUP_KINDS = ['magnet', 'shield', 'doubleCoin', 'speed', 'jetpack', 'invincible', 'slowMotion'];

/**
 * Generates one chunk's worth of obstacles/coins/gems/keys/mystery boxes/powerups.
 * @param {number} seed race seed
 * @param {number} chunkIndex 0-based chunk index
 * @param {number} density difficulty multiplier from WorldRuntime (>=1)
 */
export function generateChunk(seed, chunkIndex, density = 1) {
  const rng = chunkRng(seed, chunkIndex);
  const chunkStart = chunkIndex * CHUNK_SIZE;
  const obstacles = [];
  const coins = [];
  const gems = [];
  const keys = [];
  const mysteryBoxes = [];
  const powerups = [];

  const isSafe = chunkIndex < SAFE_CHUNKS;
  const spawnChance = Math.min(0.85, 0.5 * density);

  if (!isSafe && rng.chance(spawnChance)) {
    const hardChance = Math.min(0.6, 0.15 * density);
    const pool = PATTERNS.filter((p) => (hardChance > 0.3 ? true : p.density === 1));
    const pattern = rng.pick(pool.length ? pool : PATTERNS);
    for (const item of pattern.items) {
      obstacles.push({
        x: chunkStart + item.dx,
        kind: item.kind,
        w: item.w,
        h: item.h,
        gap: item.gap || 0,
        action: item.action,
      });
    }
    // Reward coin arc placed just past the obstacle group, roughly matching a jump arc.
    const lastDx = pattern.items[pattern.items.length - 1].dx;
    coins.push(...placeCoinArc(chunkStart, lastDx + 90, rng));
  } else if (!isSafe) {
    // Breathing-room chunk: no obstacles, just a rewarding coin line.
    coins.push(...placeCoinLine(chunkStart, rng));
  } else {
    coins.push(...placeCoinLine(chunkStart, rng));
  }

  // A gem is rarer and worth more than a coin: occasionally promote one collected coin to a gem.
  if (!isSafe && coins.length && rng.chance(0.14)) {
    const victim = coins[rng.int(0, coins.length - 1)];
    gems.push({ x: victim.x, heightAboveGround: victim.heightAboveGround, collected: false });
    coins.splice(coins.indexOf(victim), 1);
  }

  if (!isSafe && rng.chance(0.07)) {
    keys.push({ x: chunkStart + rng.range(120, CHUNK_SIZE - 120), heightAboveGround: 55, collected: false });
  }

  if (!isSafe && rng.chance(0.045)) {
    mysteryBoxes.push({ x: chunkStart + rng.range(120, CHUNK_SIZE - 120), heightAboveGround: 60, collected: false });
  }

  if (!isSafe && rng.chance(Math.min(0.22, 0.1 * density))) {
    powerups.push({
      x: chunkStart + rng.range(120, CHUNK_SIZE - 120),
      heightAboveGround: 60,
      kind: rng.pick(POWERUP_KINDS),
      collected: false,
    });
  }

  return { chunkIndex, chunkStart, obstacles, coins, gems, keys, mysteryBoxes, powerups };
}
