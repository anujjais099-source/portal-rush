/**
 * Thin wrapper around the Socket.io client for PORTAL RUSH's multiplayer
 * race rooms. Expects the `io` global from the server-provided
 * /socket.io/socket.io.js script (included in ui/index.html) to already be
 * on the page.
 */

const PROGRESS_INTERVAL_MS = 150;

export class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.roomCode = null;
    this._lastProgressSent = 0;
  }

  connect() {
    if (this.socket) return this.socket;
    // On the web the server serves this page, so io() defaults to the right
    // origin. The Android build runs from a local WebView, so it must be told
    // the deployed server's origin explicitly (injected as window.PR_SERVER).
    const origin = (typeof window !== 'undefined' && window.PR_SERVER) || '';
    this.socket = origin ? window.io(origin) : window.io();
    return this.socket;
  }

  identify(playerId) {
    this.connect().emit('identify', { playerId });
  }

  createRoom({ name, characterId, playerId }) {
    this.connect().emit('room:create', { name, characterId, playerId });
  }

  joinRoom(code, { name, characterId, playerId }) {
    this.connect().emit('room:join', { code: String(code || '').toUpperCase(), name, characterId, playerId });
  }

  leaveRoom() {
    if (this.socket) this.socket.emit('room:leave');
    this.roomCode = null;
  }

  setReady(ready) {
    if (this.socket) this.socket.emit('room:ready', { ready });
  }

  /** @param {string[]} unlockedWorldIds host's unlocked worlds — becomes the shared pool for the whole room */
  startRace(unlockedWorldIds) {
    if (this.socket) this.socket.emit('room:start', { unlockedWorldIds });
  }

  /** Throttled: safe to call every animation frame from the HUD tick. */
  sendProgress(payload) {
    const now = performance.now();
    if (now - this._lastProgressSent < PROGRESS_INTERVAL_MS) return;
    this._lastProgressSent = now;
    if (this.socket) this.socket.emit('race:progress', payload);
  }

  finishRace(payload) {
    if (this.socket) this.socket.emit('race:finish', payload);
  }

  sendChat(text) {
    if (this.socket) this.socket.emit('chat:send', { text });
  }

  on(event, handler) {
    this.connect().on(event, handler);
  }

  off(event, handler) {
    if (this.socket) this.socket.off(event, handler);
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
    this.socket = null;
  }
}

export const multiplayer = new MultiplayerClient();
