'use strict';
/**
 * Wires Socket.io events to the RoomManager. This is the live multiplayer
 * layer: rooms are lobbies where players ready up, then race together on a
 * shared deterministic seed (each client procedurally generates the same
 * obstacle layout from `seed` in game/worldRuntime.js). Progress is relayed
 * in real time so every client can render a live standings sidebar.
 */

const crypto = require('crypto');
const { sanitizeName } = require('../players/PlayerSession');
const WORLDS = require('../worlds/worldConfig');

const COUNTDOWN_SECONDS = 3;
const RESULTS_GRACE_MS = 15000; // if not everyone finishes, settle the race after this long
const ALL_WORLD_IDS = WORLDS.map((w) => w.id);

/** Validates the host-supplied unlock set against the real world roster; falls back to just the always-unlocked worlds. */
function sanitizeUnlockedWorldIds(ids) {
  const valid = Array.isArray(ids) ? ids.filter((id) => ALL_WORLD_IDS.includes(id)) : [];
  if (valid.length) return valid;
  return WORLDS.filter((w) => w.unlockLevel <= 1).map((w) => w.id);
}

function broadcastLobby(io, room) {
  io.to(room.code).emit('room:state', room.toLobbyState());
}

function broadcastStandings(io, room) {
  io.to(room.code).emit('race:update', { standings: room.standings() });
}

function settleRace(io, room, timers) {
  if (room.state !== 'racing') return;
  room.state = 'finished';
  io.to(room.code).emit('race:results', { standings: room.standings() });
  const t = timers.get(room.code);
  if (t) {
    clearTimeout(t);
    timers.delete(room.code);
  }
  for (const m of room.members.values()) m.ready = false;
  room.state = 'lobby';
  broadcastLobby(io, room);
}

function registerSocketHandlers(io, { roomManager, sessionRegistry, db }) {
  const raceTimers = new Map(); // roomCode -> settle timeout

  io.on('connection', (socket) => {
    socket.on('identify', ({ playerId } = {}) => {
      if (playerId) sessionRegistry.bind(socket.id, playerId);
    });

    socket.on('room:create', ({ name, characterId, playerId } = {}) => {
      if (playerId) sessionRegistry.bind(socket.id, playerId);
      const room = roomManager.createRoom(socket.id, {
        playerId: playerId || socket.id,
        name: sanitizeName(name),
        characterId: characterId || 'rook',
      });
      socket.join(room.code);
      socket.emit('room:joined', { code: room.code });
      broadcastLobby(io, room);
    });

    socket.on('room:join', ({ code, name, characterId, playerId } = {}) => {
      if (playerId) sessionRegistry.bind(socket.id, playerId);
      const result = roomManager.joinRoom(code, socket.id, {
        playerId: playerId || socket.id,
        name: sanitizeName(name),
        characterId: characterId || 'rook',
      });
      if (!result.ok) {
        socket.emit('room:error', { reason: result.reason });
        return;
      }
      socket.join(result.room.code);
      socket.emit('room:joined', { code: result.room.code });
      broadcastLobby(io, result.room);
    });

    socket.on('room:leave', () => {
      const room = roomManager.leaveBySocket(socket.id);
      if (room) {
        socket.leave(room.code);
        if (room.size > 0) broadcastLobby(io, room);
      }
    });

    socket.on('room:ready', ({ ready } = {}) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      room.setReady(socket.id, !!ready);
      broadcastLobby(io, room);
    });

    socket.on('room:start', (payload = {}) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      if (room.hostSocketId !== socket.id) {
        socket.emit('room:error', { reason: 'not_host' });
        return;
      }
      if (room.state !== 'lobby') return;
      // The host's unlocked-world set becomes the shared pool for every racer in the
      // room, so the seeded portal picker produces an identical world sequence for all.
      const unlockedWorldIds = sanitizeUnlockedWorldIds(payload.unlockedWorldIds);
      room.state = 'countdown';
      broadcastLobby(io, room);

      let remaining = COUNTDOWN_SECONDS;
      io.to(room.code).emit('room:countdown', { seconds: remaining });
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          io.to(room.code).emit('room:countdown', { seconds: remaining });
          return;
        }
        clearInterval(interval);
        const seed = crypto.randomInt(1, 2147483647);
        room.beginRace(seed);
        io.to(room.code).emit('race:start', { seed, startAt: Date.now(), unlockedWorldIds });

        const timer = setTimeout(() => settleRace(io, room, raceTimers), RESULTS_GRACE_MS);
        raceTimers.set(room.code, timer);
      }, 1000);
    });

    socket.on('race:progress', (payload = {}) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      room.updateProgress(socket.id, payload);
      broadcastStandings(io, room);
    });

    socket.on('race:finish', async (payload = {}) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      // Client sends REST-style field names (coinsCollected/gemsCollected/keysCollected);
      // the in-room live-standings model just wants a plain `coins` count.
      room.finishMember(socket.id, {
        distance: payload.distance,
        score: payload.score,
        coins: payload.coinsCollected,
      });
      broadcastStandings(io, room);

      const playerId = sessionRegistry.playerIdFor(socket.id);
      if (playerId) {
        try {
          await db.saveRun(playerId, {
            score: payload.score,
            distance: payload.distance,
            coinsCollected: payload.coinsCollected,
            gemsCollected: payload.gemsCollected,
            keysCollected: payload.keysCollected,
            mysteryBoxesOpened: payload.mysteryBoxesOpened,
            portalsUsed: payload.portalsUsed,
            powerupsUsed: payload.powerupsUsed,
            worldName: payload.worldName,
          });
        } catch (err) {
          // Non-fatal: the race result still counts locally for this room.
        }
      }

      if (room.allFinished()) settleRace(io, room, raceTimers);
    });

    socket.on('chat:send', ({ text } = {}) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      const clean = String(text || '').slice(0, 200).trim();
      if (!clean) return;
      const member = room.members.get(socket.id);
      io.to(room.code).emit('chat:message', {
        name: member ? member.name : 'Runner',
        text: clean,
        at: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      const room = roomManager.leaveBySocket(socket.id);
      sessionRegistry.unbind(socket.id);
      if (room && room.size > 0) broadcastLobby(io, room);
    });
  });
}

module.exports = { registerSocketHandlers };
