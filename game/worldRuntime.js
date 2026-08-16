import { chunkRng } from './rng.js';

/**
 * Maps a global "distance traveled" value to a world segment (which world
 * palette/physics apply, and where the next portal sits). Each portal
 * crossing seeded-randomly picks the next world (never immediately
 * repeating the one you're leaving) from the player's set of *unlocked*
 * worlds, rather than a fixed order, so runs feel varied while staying
 * perfectly deterministic from `seed` — required so every racer in a
 * multiplayer room sees the identical sequence of worlds (everyone in a
 * room races with the host's unlock set, resolved before the race starts).
 * Difficulty escalates steadily with every full lap's worth of portals
 * crossed, regardless of which worlds those were.
 */

const WORLDS = (typeof window !== 'undefined' && window.PR_WORLDS) || [];

const LOOP_SPEED_BONUS = 0.06; // extra speed multiplier per full lap's worth of portals crossed
const LOOP_DENSITY_BONUS = 0.08; // extra obstacle/coin density per full lap's worth of portals crossed
const WORLD_PICK_SALT = 90000; // keeps this RNG stream distinct from level-chunk generation

function pickNextWorldIndex(seed, segmentIndex, avoidIndex, available) {
  const rng = chunkRng(seed, WORLD_PICK_SALT + segmentIndex);
  let idx = available[rng.int(0, available.length - 1)];
  if (available.length > 1 && idx === avoidIndex) {
    idx = available[(available.indexOf(idx) + 1) % available.length];
  }
  return idx;
}

export class WorldRuntime {
  /**
   * @param {number} startIndex which world (index into worlds/worldConfig.js) the run opens in
   * @param {number} seed race seed driving the (deterministic) random world order
   * @param {number[]|null} availableIndices world indices the player has unlocked; null = all of them
   */
  constructor(startIndex = 0, seed = 1, availableIndices = null) {
    this.available = availableIndices && availableIndices.length ? availableIndices : WORLDS.map((_, i) => i);
    this.startIndex = this.available.includes(startIndex) ? startIndex : this.available[0];
    this.seed = seed;
    /** @type {{worldIndex:number, loop:number, start:number, end:number}[]} */
    this.segments = [];
    this._extendTo(0);
  }

  _extendTo(distance) {
    let cursor = this.segments.length
      ? this.segments[this.segments.length - 1].end
      : 0;
    let worldIndex = this.segments.length
      ? pickNextWorldIndex(this.seed, this.segments.length, this.segments[this.segments.length - 1].worldIndex, this.available)
      : this.startIndex;

    while (cursor <= distance + 2000) {
      const world = WORLDS[worldIndex];
      const start = cursor;
      const end = start + world.distanceToNext;
      const loop = Math.floor(this.segments.length / this.available.length);
      this.segments.push({ worldIndex, loop, start, end, world });
      cursor = end;
      worldIndex = pickNextWorldIndex(this.seed, this.segments.length, worldIndex, this.available);
    }
  }

  /** Returns the segment covering `distance`, generating further segments lazily. */
  segmentAt(distance) {
    if (!this.segments.length || distance > this.segments[this.segments.length - 1].end - 2000) {
      this._extendTo(distance);
    }
    let seg = this.segments.find((s) => distance >= s.start && distance < s.end);
    if (!seg) seg = this.segments[this.segments.length - 1];
    return seg;
  }

  /** Effective, loop-adjusted config for the world at `distance`. */
  configAt(distance) {
    const seg = this.segmentAt(distance);
    const w = seg.world;
    return {
      ...w,
      loop: seg.loop,
      segmentStart: seg.start,
      segmentEnd: seg.end,
      portalAt: seg.end,
      effectiveSpeedMultiplier: w.speedMultiplier * (1 + seg.loop * LOOP_SPEED_BONUS),
      effectiveDensity: 1 + seg.loop * LOOP_DENSITY_BONUS,
    };
  }

  distanceToPortal(distance) {
    return this.segmentAt(distance).end - distance;
  }
}
