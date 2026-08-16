'use strict';
/**
 * A single multiplayer race room. Holds the authoritative list of members
 * and their live race progress. Actual level generation happens on each
 * client from a shared `seed` so every runner sees the identical obstacle
 * layout; this class only tracks who is in the room and how far along
 * they've gotten, so it can broadcast a live standings list and settle a
 * final ranking when the race ends.
 */

const MAX_PLAYERS_PER_ROOM = 8;

class Room {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.state = 'lobby'; // lobby | countdown | racing | finished
    this.seed = null;
    this.createdAt = Date.now();
    this.startedAt = null;
    /** @type {Map<string, {playerId:string,name:string,characterId:string,distance:number,score:number,coins:number,alive:boolean,finished:boolean,ready:boolean}>} */
    this.members = new Map();
  }

  get size() {
    return this.members.size;
  }

  isFull() {
    return this.members.size >= MAX_PLAYERS_PER_ROOM;
  }

  addMember(socketId, { playerId, name, characterId }) {
    this.members.set(socketId, {
      playerId,
      name: name || 'Runner',
      characterId: characterId || 'rook',
      distance: 0,
      score: 0,
      coins: 0,
      alive: true,
      finished: false,
      ready: false,
    });
  }

  removeMember(socketId) {
    this.members.delete(socketId);
    if (this.hostSocketId === socketId) {
      const next = this.members.keys().next();
      this.hostSocketId = next.done ? null : next.value;
    }
  }

  setReady(socketId, ready) {
    const m = this.members.get(socketId);
    if (m) m.ready = ready;
  }

  allReady() {
    if (this.members.size === 0) return false;
    for (const m of this.members.values()) if (!m.ready) return false;
    return true;
  }

  beginRace(seed) {
    this.state = 'racing';
    this.seed = seed;
    this.startedAt = Date.now();
    for (const m of this.members.values()) {
      m.distance = 0;
      m.score = 0;
      m.coins = 0;
      m.alive = true;
      m.finished = false;
    }
  }

  updateProgress(socketId, { distance, score, coins, alive }) {
    const m = this.members.get(socketId);
    if (!m || this.state !== 'racing') return;
    m.distance = distance;
    m.score = score;
    m.coins = coins;
    m.alive = alive;
  }

  finishMember(socketId, { distance, score, coins }) {
    const m = this.members.get(socketId);
    if (!m) return;
    m.distance = distance;
    m.score = score;
    m.coins = coins;
    m.alive = false;
    m.finished = true;
  }

  allFinished() {
    if (this.members.size === 0) return false;
    for (const m of this.members.values()) if (!m.finished) return false;
    return true;
  }

  standings() {
    return [...this.members.values()]
      .map((m) => ({ ...m }))
      .sort((a, b) => b.score - a.score || b.distance - a.distance);
  }

  toLobbyState() {
    return {
      code: this.code,
      hostSocketId: this.hostSocketId,
      state: this.state,
      members: [...this.members.entries()].map(([socketId, m]) => ({
        socketId,
        ...m,
      })),
    };
  }
}

module.exports = { Room, MAX_PLAYERS_PER_ROOM };
