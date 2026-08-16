'use strict';
/** Owns the lifecycle of every active multiplayer room, keyed by a 4-character room code. */

const crypto = require('crypto');
const { Room } = require('./Room');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
const CODE_LENGTH = 4;

class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  _generateCode() {
    let code;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostSocketId, memberInfo) {
    const code = this._generateCode();
    const room = new Room(code, hostSocketId);
    room.addMember(hostSocketId, memberInfo);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(String(code || '').toUpperCase()) || null;
  }

  joinRoom(code, socketId, memberInfo) {
    const room = this.getRoom(code);
    if (!room) return { ok: false, reason: 'not_found' };
    if (room.isFull()) return { ok: false, reason: 'full' };
    if (room.state === 'racing' || room.state === 'countdown') {
      return { ok: false, reason: 'in_progress' };
    }
    room.addMember(socketId, memberInfo);
    return { ok: true, room };
  }

  /** Removes a socket from whichever room it belongs to; deletes the room if it becomes empty. */
  leaveBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.members.has(socketId)) {
        room.removeMember(socketId);
        if (room.size === 0) this.rooms.delete(room.code);
        return room;
      }
    }
    return null;
  }

  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.members.has(socketId)) return room;
    }
    return null;
  }
}

module.exports = { RoomManager };
