'use strict';
/**
 * Tracks which authenticated player profile (database/db.js record) owns
 * each live socket connection, and provides small validation helpers used
 * by both the REST API and the socket handlers.
 */

const ADJECTIVES = ['Swift', 'Neon', 'Cosmic', 'Turbo', 'Shadow', 'Blazing', 'Quantum', 'Solar'];
const NOUNS = ['Fox', 'Runner', 'Comet', 'Ghost', 'Falcon', 'Wisp', 'Nova', 'Drifter'];

function randomGuestName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 90 + 10)}`;
}

function sanitizeName(name) {
  const cleaned = String(name || '').replace(/[^\w \-']/g, '').trim().slice(0, 16);
  return cleaned.length ? cleaned : randomGuestName();
}

/** socketId -> playerId, so socket handlers can look up the database profile behind a connection. */
class SessionRegistry {
  constructor() {
    this.socketToPlayer = new Map();
  }

  bind(socketId, playerId) {
    this.socketToPlayer.set(socketId, playerId);
  }

  unbind(socketId) {
    this.socketToPlayer.delete(socketId);
  }

  playerIdFor(socketId) {
    return this.socketToPlayer.get(socketId) || null;
  }
}

module.exports = { SessionRegistry, sanitizeName, randomGuestName };
