'use strict';
/**
 * PORTAL RUSH server.
 *
 * Serves the client (static files) and exposes:
 *  - a small REST API for player profiles, character unlocks, run saving,
 *    and the global leaderboard (database/db.js, a JSON-file store)
 *  - a Socket.io layer for multiplayer race rooms (rooms/, server/socketHandlers.js)
 *
 * Run with `npm start`; open http://localhost:3000
 */

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const db = require('../database/db');
const CHARACTERS = require('../characters/characterConfig');
const WORLDS = require('../worlds/worldConfig');
const { RoomManager } = require('../rooms/RoomManager');
const { SessionRegistry, sanitizeName } = require('../players/PlayerSession');
const { registerSocketHandlers } = require('./socketHandlers');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

const app = express();
app.use(express.json());

// The Android build runs inside a WebView served from capacitor://localhost or
// https://localhost, so its API calls are cross-origin. Socket.io already sets
// its own CORS; the REST API needs the same. Read-mostly public game data with
// no cookie auth, so a permissive origin is safe here.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Static client assets. Each top-level folder maps 1:1 to a URL prefix so
// characters/characterConfig.js and worlds/worldConfig.js can be loaded by
// the browser with plain <script> tags, same as the UI/game/asset code.
app.use(express.static(path.join(ROOT, 'ui')));
app.use('/game', express.static(path.join(ROOT, 'game')));
app.use('/worlds', express.static(path.join(ROOT, 'worlds')));
app.use('/characters', express.static(path.join(ROOT, 'characters')));
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/multiplayer', express.static(path.join(ROOT, 'multiplayer')));

const characterById = new Map(CHARACTERS.map((c) => [c.id, c]));
const worldById = new Map(WORLDS.map((w) => [w.id, w]));

// ---------------------------------------------------------------- REST API

app.post('/api/player', async (req, res) => {
  const profile = await db.createPlayer(sanitizeName(req.body && req.body.name));
  res.json(profile);
});

app.get('/api/player/:id', async (req, res) => {
  const profile = await db.getPlayer(req.params.id);
  if (!profile) return res.status(404).json({ error: 'not_found' });
  res.json(profile);
});

app.post('/api/player/:id/rename', async (req, res) => {
  const profile = await db.renamePlayer(req.params.id, sanitizeName(req.body && req.body.name));
  if (!profile) return res.status(404).json({ error: 'not_found' });
  res.json(profile);
});

app.post('/api/player/:id/select-character', async (req, res) => {
  const { characterId } = req.body || {};
  if (!characterById.has(characterId)) return res.status(400).json({ error: 'unknown_character' });
  const profile = await db.selectCharacter(req.params.id, characterId);
  if (!profile) return res.status(400).json({ error: 'not_unlocked_or_missing_player' });
  res.json(profile);
});

app.post('/api/player/:id/select-world', async (req, res) => {
  const { worldId } = req.body || {};
  if (!worldById.has(worldId)) return res.status(400).json({ error: 'unknown_world' });
  const profile = await db.selectWorld(req.params.id, worldId);
  if (!profile) return res.status(404).json({ error: 'not_found' });
  res.json(profile);
});

app.post('/api/player/:id/exchange-gems', async (req, res) => {
  const { gemCount } = req.body || {};
  const result = await db.exchangeGems(req.params.id, Number(gemCount) || 1);
  if (!result.profile) return res.status(404).json({ error: 'not_found' });
  res.status(result.ok ? 200 : 402).json(result);
});

app.post('/api/player/:id/unlock-character', async (req, res) => {
  const { characterId } = req.body || {};
  const character = characterById.get(characterId);
  if (!character) return res.status(400).json({ error: 'unknown_character' });
  const result = await db.unlockCharacter(req.params.id, characterId, character.cost);
  if (!result.profile) return res.status(404).json({ error: 'not_found' });
  res.status(result.ok ? 200 : 402).json(result);
});

app.post('/api/player/:id/save-run', async (req, res) => {
  const { score, distance, coinsCollected, worldName, portalsUsed, powerupsUsed, gemsCollected, keysCollected, mysteryBoxesOpened } = req.body || {};
  const result = await db.saveRun(req.params.id, {
    score: Number(score) || 0,
    distance: Number(distance) || 0,
    coinsCollected: Number(coinsCollected) || 0,
    gemsCollected: Number(gemsCollected) || 0,
    keysCollected: Number(keysCollected) || 0,
    mysteryBoxesOpened: Number(mysteryBoxesOpened) || 0,
    portalsUsed: Number(portalsUsed) || 0,
    powerupsUsed: Number(powerupsUsed) || 0,
    worldName,
  });
  if (!result.profile) return res.status(404).json({ error: 'not_found' });
  res.json(result);
});

app.get('/api/player/:id/quests', async (req, res) => {
  const data = await db.getQuestsAndAchievements(req.params.id);
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

app.get('/api/leaderboard', async (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const range = ['daily', 'weekly', 'all'].includes(req.query.range) ? req.query.range : 'all';
  res.json(await db.getLeaderboard(limit, range));
});

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// -------------------------------------------------------------- Multiplayer

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const roomManager = new RoomManager();
const sessionRegistry = new SessionRegistry();
registerSocketHandlers(io, { roomManager, sessionRegistry, db });

// How many people are live right now: every open tab holds a Socket.io connection
// (menus.js connects on load, not just when opening Multiplayer), so this is a
// real concurrent-visitor count, not just people actively racing.
app.get('/api/live-stats', (req, res) => {
  const rooms = [...roomManager.rooms.values()];
  res.json({
    online: io.engine.clientsCount,
    activeRooms: rooms.length,
    playersInRooms: rooms.reduce((sum, r) => sum + r.size, 0),
    racingNow: rooms.filter((r) => r.state === 'racing').length,
  });
});

server.listen(PORT, () => {
  console.log(`PORTAL RUSH server running at http://localhost:${PORT}`);
});
