/**
 * Deterministic PRNG utilities shared by the whole procedural generator.
 *
 * The level is generated in fixed-size "chunks" of world distance, and each
 * chunk's contents are a pure function of (raceSeed, chunkIndex). That's
 * what lets every client in a multiplayer room render the identical
 * obstacle/coin/powerup layout without any per-frame network sync: as long
 * as two clients agree on the seed, `chunkFor(seed, i)` produces byte-for-byte
 * the same chunk regardless of frame rate or timing.
 */

/** xmur3 string/int hash -> 32-bit seed, used to derive a per-chunk seed from (seed, index). */
export function hashSeed(seed, index) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ index, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: fast, good-enough-for-games deterministic PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: a seeded RNG scoped to one chunk, with helpers used across generators. */
export function chunkRng(seed, chunkIndex) {
  const next = mulberry32(hashSeed(seed, chunkIndex));
  return {
    float: () => next(),
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length) % arr.length],
    chance: (p) => next() < p,
  };
}
