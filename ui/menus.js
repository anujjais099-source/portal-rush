import { Engine } from '../game/engine.js';
import { drawRunner, drawSun, drawMoon, drawCloud, drawTree, drawPlanet, drawPortal } from '../assets/sprites.js';
import { audio } from '../assets/audio.js';
import { multiplayer } from '../multiplayer/client.js';
import * as api from './api.js';
import { loadSettings, saveSettings } from './settings.js';
import { updateHud, showMpSidebar, hideMpSidebar, updateStandings, renderResultsList, escapeHtml } from './hud.js';

const CHARACTERS = window.PR_CHARACTERS || [];
const WORLDS = window.PR_WORLDS || [];
const XP_PER_LEVEL = 1000; // kept in sync with database/db.js's XP_PER_LEVEL

const state = {
  profile: null,
  selectedCharacterId: 'doctor',
  selectedWorldId: 'day-mode',
  settings: loadSettings(),
  mode: 'solo', // 'solo' | 'multiplayer'
  roomCode: null,
  isHost: false,
  selfReady: false,
  leaderboardRange: 'daily',
};

const canvas = document.getElementById('game-canvas');
let engine = null;

function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
function getWorld(id) {
  return WORLDS.find((w) => w.id === id) || WORLDS[0];
}
function isCharacterUnlocked(id) {
  return state.profile && state.profile.unlockedCharacters.includes(id);
}
function isWorldUnlocked(world) {
  return state.profile && state.profile.level >= world.unlockLevel;
}
function getUnlockedWorldIds() {
  return WORLDS.filter(isWorldUnlocked).map((w) => w.id);
}

// -------------------------------------------------------------- navigation

const shellEl = document.getElementById('shell');
const gameScreenEl = document.getElementById('screen-game');
const pages = {};
document.querySelectorAll('.page').forEach((p) => { pages[p.id] = p; });

const WORLD_PREVIEW_PAGES = ['page-home', 'page-worlds'];
const CHARACTER_PREVIEW_PAGES = ['page-character', 'page-shop'];

function showPage(id) {
  gameScreenEl.classList.remove('active');
  shellEl.classList.add('active');
  Object.values(pages).forEach((p) => p.classList.remove('active'));
  pages[id].classList.add('active');
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === id);
  });

  if (WORLD_PREVIEW_PAGES.includes(id)) startWorldPreviewLoop(); else stopWorldPreviewLoop();
  if (CHARACTER_PREVIEW_PAGES.includes(id)) startCharacterPreviewLoop(); else stopCharacterPreviewLoop();
  if (id === 'page-home') startHeroLoop(); else stopHeroLoop();

  if (id === 'page-worlds') renderWorldGrid();
  if (id === 'page-shop') renderCharacterGrid('shop-character-grid');
  if (id === 'page-stats') renderStats();
  if (id === 'page-leaderboard') renderLeaderboard();
}

function showGameScreen() {
  stopWorldPreviewLoop();
  stopCharacterPreviewLoop();
  stopHeroLoop();
  shellEl.classList.remove('active');
  gameScreenEl.classList.add('active');
}

document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ------------------------------------------------------------ first-gesture audio unlock

function unlockAudioOnce() {
  audio.unlock();
  window.removeEventListener('pointerdown', unlockAudioOnce);
  window.removeEventListener('keydown', unlockAudioOnce);
}
window.addEventListener('pointerdown', unlockAudioOnce);
window.addEventListener('keydown', unlockAudioOnce);

// ------------------------------------------------------------------- profile

async function refreshProfileUI() {
  const p = state.profile;
  document.getElementById('title-player-name').textContent = p.name;
  document.getElementById('title-coins').textContent = p.coins.toLocaleString();
  document.getElementById('title-gems').textContent = p.gems.toLocaleString();
  document.getElementById('title-stars').textContent = p.stars;
  document.getElementById('title-level').textContent = p.level;
  document.getElementById('xp-bar-fill').style.width = `${Math.min(100, ((p.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)}%`;

  document.getElementById('stat-highest-score').textContent = p.bestScore.toLocaleString();
  document.getElementById('stat-total-runs').textContent = p.totalRuns.toLocaleString();
  document.getElementById('stat-worlds-unlocked').textContent = `${getUnlockedWorldIds().length} / ${WORLDS.length}`;

  document.getElementById('shop-coins').textContent = p.coins.toLocaleString();
  document.getElementById('shop-gems').textContent = p.gems.toLocaleString();

  // If the previously-selected world became invalid somehow, fall back to the first unlocked one.
  if (!getUnlockedWorldIds().includes(state.selectedWorldId)) {
    state.selectedWorldId = getUnlockedWorldIds()[0] || 'day-mode';
  }
}

async function initProfile() {
  state.profile = await api.getOrCreateProfile();
  state.selectedCharacterId = state.profile.selectedCharacter || 'doctor';
  state.selectedWorldId = state.profile.selectedWorld || 'day-mode';
  await refreshProfileUI();
}

document.getElementById('btn-rename').addEventListener('click', async () => {
  const name = window.prompt('Enter your runner name (max 16 chars):', state.profile.name);
  if (!name) return;
  state.profile = await api.renamePlayer(state.profile.id, name);
  await refreshProfileUI();
});

// -------------------------------------------------------------------- nav actions

document.getElementById('btn-play-solo').addEventListener('click', () => startSoloRun());
document.getElementById('btn-exchange-gems').addEventListener('click', async () => {
  if (state.profile.gems < 1) return;
  const result = await api.exchangeGems(state.profile.id, 1);
  if (result.ok && result.profile) {
    state.profile = result.profile;
    await refreshProfileUI();
  }
});

// ------------------------------------------------------------------- worlds

async function selectWorldFlow(worldId) {
  const world = getWorld(worldId);
  if (!isWorldUnlocked(world)) return;
  state.selectedWorldId = worldId;
  state.profile = await api.selectWorld(state.profile.id, worldId);
  renderModeList();
  renderWorldGrid();
}

function renderModeList() {
  const list = document.getElementById('mode-list');
  list.innerHTML = '';
  for (const world of WORLDS) {
    const unlocked = isWorldUnlocked(world);
    const item = document.createElement('div');
    item.className = 'mode-item' + (world.id === state.selectedWorldId ? ' selected' : '') + (unlocked ? '' : ' locked');
    item.innerHTML = `
      <span class="mode-item-icon">${unlocked ? world.icon : '🔒'}</span>
      <span class="mode-item-body">
        <div class="mode-item-name">${escapeHtml(world.name)}</div>
        <div class="mode-item-tagline">${unlocked ? escapeHtml(world.tagline) : `Unlock at Lv. ${world.unlockLevel}`}</div>
      </span>
      <span class="mode-item-arrow">${unlocked ? '›' : ''}</span>`;
    if (unlocked) item.addEventListener('click', () => selectWorldFlow(world.id));
    list.appendChild(item);
  }
}

function renderWorldGrid() {
  const grid = document.getElementById('world-grid');
  grid.innerHTML = '';
  for (const world of WORLDS) {
    const unlocked = isWorldUnlocked(world);
    const card = document.createElement('div');
    card.className = 'world-card' + (world.id === state.selectedWorldId ? ' selected' : '') + (unlocked ? '' : ' locked');

    const cv = document.createElement('canvas');
    cv.width = 400; cv.height = 130;
    cv.dataset.worldId = world.id;
    cv.classList.add('world-preview-canvas');
    card.appendChild(cv);

    if (!unlocked) {
      const lock = document.createElement('div');
      lock.className = 'world-card-lock';
      lock.innerHTML = `<span class="lock-glyph">🔒</span><span>${escapeHtml(world.name)}</span><span>Unlock at Lv. ${world.unlockLevel}</span>`;
      card.appendChild(lock);
    }

    const body = document.createElement('div');
    body.className = 'world-card-body';
    body.innerHTML = `<div class="world-card-name">${escapeHtml(world.name)}</div><div class="world-card-tagline">${escapeHtml(world.tagline)}</div>`;
    card.appendChild(body);

    if (unlocked) card.addEventListener('click', () => selectWorldFlow(world.id));
    grid.appendChild(card);
  }
}

function renderWorldPreviews() {
  const list = document.getElementById('world-preview-list');
  list.innerHTML = '';
  for (const world of WORLDS) {
    const unlocked = isWorldUnlocked(world);
    const wrap = document.createElement('div');
    wrap.className = 'world-preview-item' + (unlocked ? '' : ' locked');
    const canvasEl = document.createElement('canvas');
    canvasEl.width = 400;
    canvasEl.height = 90;
    canvasEl.dataset.worldId = world.id;
    canvasEl.classList.add('world-preview-canvas');
    wrap.appendChild(canvasEl);
    if (unlocked) {
      const label = document.createElement('span');
      label.className = 'world-preview-label';
      label.textContent = world.name;
      wrap.appendChild(label);
    } else {
      const overlay = document.createElement('div');
      overlay.className = 'lock-overlay';
      overlay.innerHTML = `<span class="lock-glyph">🔒</span><span>${escapeHtml(world.name)}<br>Unlock at Lv. ${world.unlockLevel}</span>`;
      wrap.appendChild(overlay);
    }
    list.appendChild(wrap);
  }
}

let worldPreviewRaf = null;
function startWorldPreviewLoop() {
  stopWorldPreviewLoop();
  const t0 = performance.now();
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    document.querySelectorAll('.world-preview-canvas').forEach((cv) => {
      drawWorldPreviewFrame(cv, getWorld(cv.dataset.worldId), t);
    });
    worldPreviewRaf = requestAnimationFrame(tick);
  };
  worldPreviewRaf = requestAnimationFrame(tick);
}
function stopWorldPreviewLoop() {
  if (worldPreviewRaf) cancelAnimationFrame(worldPreviewRaf);
  worldPreviewRaf = null;
}

function drawWorldPreviewFrame(cv, cfg, t) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const groundY = h * 0.72;
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, cfg.sky[0]);
  grad.addColorStop(0.55, cfg.sky[1]);
  grad.addColorStop(1, cfg.sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, groundY);

  if (cfg.celestial === 'sun') drawSun(ctx, w * 0.78, h * 0.22, 14);
  if (cfg.celestial === 'moon') drawMoon(ctx, w * 0.78, h * 0.2, 11);
  if (cfg.skylineStyle === 'city-day') drawCloud(ctx, (w * 0.3 + t * 12) % w, h * 0.18, 0.6);

  if (cfg.skylineStyle === 'space') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 2 + i));
      ctx.fillRect((i * 37) % w, (i * 53) % (groundY - 10), 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    drawPlanet(ctx, w * 0.2, h * 0.28, 9, '#ff8fd0', true);
    drawPlanet(ctx, w * 0.55, h * 0.15, 5, '#8fd0ff', false);
  } else if (cfg.skylineStyle === 'forest') {
    for (let i = 0; i < 6; i++) drawTree(ctx, (i * 70 - t * 14) % (w + 70), groundY, 46, i % 2 ? '#2f8f5f' : '#3aa86e', '#4a2f1a');
  } else if (cfg.skylineStyle === 'volcano') {
    for (let i = 0; i < 4; i++) {
      const px = (i * 130 - t * 10) % (w + 130);
      ctx.fillStyle = '#1e0a06';
      ctx.beginPath();
      ctx.moveTo(px, groundY);
      ctx.lineTo(px + 35, groundY - 40);
      ctx.lineTo(px + 70, groundY);
      ctx.closePath();
      ctx.fill();
    }
  } else if (cfg.skylineStyle === 'snow') {
    for (let i = 0; i < 5; i++) {
      const px = (i * 110 - t * 10) % (w + 110);
      ctx.fillStyle = '#8fb8d8';
      ctx.beginPath();
      ctx.moveTo(px, groundY);
      ctx.lineTo(px + 30, groundY - 34);
      ctx.lineTo(px + 60, groundY);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const bx = (i * 90 - t * 10) % (w + 90);
      const bh = 22 + ((i * 17) % 24);
      ctx.fillStyle = `${cfg.ground}dd`;
      ctx.fillRect(bx, groundY - bh, 34, bh);
    }
  }

  ctx.fillStyle = cfg.ground;
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.strokeStyle = cfg.groundLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();

  const character = getCharacter(state.selectedCharacterId);
  drawRunner(ctx, { x: w * 0.22, y: groundY, width: 18, height: 26, color: character.color, accent: character.accent, state: 'run', t, look: character.look });
}

// -------------------------------------------------------------------- hero

let heroRaf = null;
function startHeroLoop() {
  stopHeroLoop();
  const cv = document.getElementById('hero-canvas');
  const ctx = cv.getContext('2d');
  const t0 = performance.now();
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    const cfg = getWorld(state.selectedWorldId);
    const grad = ctx.createRadialGradient(w / 2, h * 0.42, 20, w / 2, h * 0.42, h * 0.55);
    grad.addColorStop(0, `${cfg.accent}22`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    drawPortal(ctx, w / 2, h * 0.42, h * 0.34, t, cfg.particle);
    const character = getCharacter(state.selectedCharacterId);
    drawRunner(ctx, { x: w / 2, y: h * 0.82, width: 36, height: 56, color: character.color, accent: character.accent, state: 'run', t: t * 0.6, look: character.look });
    heroRaf = requestAnimationFrame(tick);
  };
  heroRaf = requestAnimationFrame(tick);
}
function stopHeroLoop() {
  if (heroRaf) cancelAnimationFrame(heroRaf);
  heroRaf = null;
}

// sidebar mini portal logo — cheap enough to just run for the life of the page
let logoRaf = null;
function startLogoLoop() {
  const cv = document.getElementById('sidebar-logo-canvas');
  const ctx = cv.getContext('2d');
  const t0 = performance.now();
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawPortal(ctx, cv.width / 2, cv.height / 2, cv.width * 0.42, t, '#00f0ff');
    logoRaf = requestAnimationFrame(tick);
  };
  logoRaf = requestAnimationFrame(tick);
}

// -------------------------------------------------------------- characters

let previewRaf = null;
function startCharacterPreviewLoop() {
  stopCharacterPreviewLoop();
  const tick = () => {
    const t = performance.now() / 1000;
    document.querySelectorAll('#character-grid canvas, #shop-character-grid canvas').forEach((cv) => {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      const character = getCharacter(cv.dataset.characterId);
      drawRunner(ctx, { x: cv.width / 2, y: cv.height - 10, width: 26, height: 40, color: character.color, accent: character.accent, state: 'run', t, look: character.look });
    });
    previewRaf = requestAnimationFrame(tick);
  };
  previewRaf = requestAnimationFrame(tick);
}
function stopCharacterPreviewLoop() {
  if (previewRaf) cancelAnimationFrame(previewRaf);
  previewRaf = null;
}

/** Renders the full character roster into either the Character page or the Shop page. */
function renderCharacterGrid(containerId = 'character-grid') {
  const grid = document.getElementById(containerId);
  grid.innerHTML = '';

  for (const character of CHARACTERS) {
    const unlocked = isCharacterUnlocked(character.id);
    const selected = state.selectedCharacterId === character.id;

    const card = document.createElement('div');
    card.className = 'character-card' + (selected ? ' selected' : '');

    const cv = document.createElement('canvas');
    cv.width = 80; cv.height = 70;
    cv.dataset.characterId = character.id;
    card.appendChild(cv);

    const name = document.createElement('div');
    name.className = 'character-name';
    name.textContent = character.name;
    card.appendChild(name);

    const tagline = document.createElement('div');
    tagline.className = 'character-tagline';
    tagline.textContent = character.tagline;
    card.appendChild(tagline);

    const btn = document.createElement('button');
    btn.className = 'btn';
    if (selected) {
      btn.textContent = 'Selected';
      btn.disabled = true;
    } else if (unlocked) {
      btn.textContent = 'Select';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        state.profile = await api.selectCharacter(state.profile.id, character.id);
        state.selectedCharacterId = character.id;
        renderCharacterGrid(containerId);
      });
    } else {
      const cost = document.createElement('div');
      cost.className = 'character-cost';
      cost.textContent = `🪙 ${character.cost}`;
      card.appendChild(cost);
      btn.textContent = 'Unlock';
      btn.disabled = state.profile.coins < character.cost;
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = await api.unlockCharacter(state.profile.id, character.id);
        if (result.ok && result.profile) {
          state.profile = result.profile;
          await refreshProfileUI();
          renderCharacterGrid(containerId);
        } else {
          btn.textContent = 'Not enough coins';
          setTimeout(() => renderCharacterGrid(containerId), 1200);
        }
      });
    }
    card.appendChild(btn);
    grid.appendChild(card);
  }
}

// -------------------------------------------------------- quests / achievements / challenge

async function renderQuestsAndAchievements() {
  const data = await api.getQuests(state.profile.id);
  if (!data) return;

  const questList = document.getElementById('quest-list');
  questList.innerHTML = '';
  for (const q of data.quests) {
    const pct = Math.round((q.progress / q.target) * 100);
    const item = document.createElement('div');
    item.className = 'quest-item';
    item.innerHTML = `
      <div class="quest-item-head">
        <span class="quest-item-name${q.claimed ? ' done' : ''}">${escapeHtml(q.name)}</span>
        <span class="quest-item-reward">🪙 ${q.reward}</span>
      </div>
      <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
      <div class="quest-item-desc">${q.progress}/${q.target}</div>`;
    questList.appendChild(item);
  }

  const achList = document.getElementById('achievement-list');
  achList.innerHTML = '';
  for (const a of data.achievements) {
    const pct = Math.round((a.progress / a.target) * 100);
    const item = document.createElement('div');
    item.className = 'quest-item';
    item.innerHTML = `
      <div class="quest-item-head">
        <span class="quest-item-name${a.unlocked ? ' done' : ''}">${escapeHtml(a.name)}</span>
      </div>
      <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
      <div class="quest-item-desc">${escapeHtml(a.description)} · ${a.progress}/${a.target}</div>`;
    achList.appendChild(item);
  }

  const c = data.dailyChallenge;
  const cPct = Math.round((c.progress / c.target) * 100);
  document.getElementById('daily-challenge').innerHTML = `
    <div class="quest-item-head">
      <span class="quest-item-name${c.claimed ? ' done' : ''}">${escapeHtml(c.name)}</span>
      <span class="quest-item-reward">✨ ${c.rewardXp} XP</span>
    </div>
    <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${cPct}%"></div></div>
    <div class="quest-item-desc">${c.progress}/${c.target}</div>`;
}

// -------------------------------------------------------------- statistics

function renderStats() {
  const p = state.profile;
  const cards = [
    ['Level', p.level],
    ['XP', p.xp.toLocaleString()],
    ['Total Runs', p.totalRuns.toLocaleString()],
    ['Total Distance', `${(p.totalDistance / 1000).toFixed(1)} km`],
    ['Best Score', p.bestScore.toLocaleString()],
    ['Best Distance', `${p.bestDistance.toLocaleString()}m`],
    ['Coins Earned (lifetime)', p.totalCoinsEarned.toLocaleString()],
    ['Gems', p.gems.toLocaleString()],
    ['Stars', p.stars],
    ['Keys Collected', p.totalKeysCollected.toLocaleString()],
    ['Mystery Boxes Opened', p.totalMysteryBoxesOpened.toLocaleString()],
    ['Portals Used', p.totalPortalsUsed.toLocaleString()],
    ['Characters Unlocked', `${p.unlockedCharacters.length} / ${CHARACTERS.length}`],
    ['Worlds Unlocked', `${getUnlockedWorldIds().length} / ${WORLDS.length}`],
  ];
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = cards.map(([label, value]) => `
    <div class="stat-card">
      <span class="stat-card-label">${escapeHtml(label)}</span>
      <span class="stat-card-value">${value}</span>
    </div>`).join('');
}

// -------------------------------------------------------------- leaderboard

async function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<li class="empty-note">Loading…</li>';
  const board = await api.getLeaderboard(10, state.leaderboardRange);
  list.innerHTML = '';
  if (!board.length) {
    list.innerHTML = '<li class="empty-note">No runs yet — be the first!</li>';
    return;
  }
  board.forEach((entry, i) => {
    const li = document.createElement('li');
    if (entry.playerId === state.profile.id) li.classList.add('self');
    li.innerHTML = `<span>#${i + 1} ${escapeHtml(entry.name)}</span><span>${entry.score} pts · ${entry.world}</span>`;
    list.appendChild(li);
  });
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.leaderboardRange = btn.dataset.range;
    renderLeaderboard();
  });
});

// ----------------------------------------------------------------- settings

const sfxSlider = document.getElementById('setting-sfx');
const musicSlider = document.getElementById('setting-music');
const muteCheckbox = document.getElementById('setting-mute');
const motionCheckbox = document.getElementById('setting-motion');

sfxSlider.value = state.settings.sfxVolume;
musicSlider.value = state.settings.musicVolume;
muteCheckbox.checked = state.settings.muted;
motionCheckbox.checked = state.settings.reducedMotion;
audio.setSfxVolume(state.settings.sfxVolume);
audio.setMusicVolume(state.settings.musicVolume);
audio.setMuted(state.settings.muted);

sfxSlider.addEventListener('input', () => {
  state.settings.sfxVolume = Number(sfxSlider.value);
  audio.setSfxVolume(state.settings.sfxVolume);
  saveSettings(state.settings);
});
musicSlider.addEventListener('input', () => {
  state.settings.musicVolume = Number(musicSlider.value);
  audio.setMusicVolume(state.settings.musicVolume);
  saveSettings(state.settings);
});
muteCheckbox.addEventListener('change', () => {
  state.settings.muted = muteCheckbox.checked;
  audio.setMuted(state.settings.muted);
  saveSettings(state.settings);
});
motionCheckbox.addEventListener('change', () => {
  state.settings.reducedMotion = motionCheckbox.checked;
  saveSettings(state.settings);
});

// --------------------------------------------------------------------- game

function ensureEngine() {
  if (engine) return engine;
  engine = new Engine(canvas, {
    onHud: onEngineHud,
    onGameOver: onEngineGameOver,
    onWorldChange: () => {},
    onPortal: () => {},
    onPauseRequested: togglePause,
  }, state.settings);
  return engine;
}

function onEngineHud(snapshot) {
  updateHud(snapshot);
  if (state.mode === 'multiplayer') {
    multiplayer.sendProgress({ distance: snapshot.distance, score: snapshot.score, coins: snapshot.coins, alive: snapshot.alive });
  }
}

const QUEST_NAMES = { 'run-2000': 'Run 2000 meters', 'collect-100-coins': 'Collect 100 coins', 'use-powerup-3': 'Use powerup 3 times' };
const ACHIEVEMENT_NAMES = {
  'first-run': 'First Run', 'coin-collector': 'Coin Collector', 'portal-master': 'Portal Master',
  'key-master': 'Key Master', 'box-opener': 'Box Opener',
};

function renderRewardChips(newlyClaimedQuests, newlyUnlockedAchievements, challengeCompleted, leveledUp, newLevel) {
  const el = document.getElementById('go-rewards');
  el.innerHTML = '';
  for (const id of newlyClaimedQuests || []) {
    const chip = document.createElement('span');
    chip.className = 'go-reward-chip';
    chip.textContent = `📅 Quest complete: ${QUEST_NAMES[id] || id}`;
    el.appendChild(chip);
  }
  if (challengeCompleted) {
    const chip = document.createElement('span');
    chip.className = 'go-reward-chip';
    chip.textContent = '🎯 Daily Challenge complete: +250 XP';
    el.appendChild(chip);
  }
  for (const id of newlyUnlockedAchievements || []) {
    const chip = document.createElement('span');
    chip.className = 'go-reward-chip';
    chip.textContent = `🏆 Achievement: ${ACHIEVEMENT_NAMES[id] || id}`;
    el.appendChild(chip);
    audio.achievement();
  }
  if (leveledUp) {
    const chip = document.createElement('span');
    chip.className = 'go-reward-chip';
    chip.textContent = `⭐ Level up! You're now level ${newLevel}`;
    el.appendChild(chip);
    audio.levelUp();
  }
}

let celebrateRaf = null;
function startCelebrateLoop() {
  stopCelebrateLoop();
  const cv = document.getElementById('gameover-celebrate');
  cv.hidden = false;
  const ctx = cv.getContext('2d');
  const character = getCharacter(state.selectedCharacterId);
  const t0 = performance.now();
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawRunner(ctx, { x: cv.width / 2, y: cv.height - 8, width: 30, height: 46, color: character.color, accent: character.accent, state: 'celebrate', t, look: character.look });
    celebrateRaf = requestAnimationFrame(tick);
  };
  celebrateRaf = requestAnimationFrame(tick);
}
function stopCelebrateLoop() {
  if (celebrateRaf) cancelAnimationFrame(celebrateRaf);
  celebrateRaf = null;
  document.getElementById('gameover-celebrate').hidden = true;
}

async function onEngineGameOver(snapshot) {
  document.getElementById('go-score').textContent = snapshot.score.toLocaleString();
  document.getElementById('go-distance').textContent = `${snapshot.distance}m`;
  document.getElementById('go-coins').textContent = snapshot.coins;

  const isNewBest = snapshot.score > state.profile.bestScore;
  document.getElementById('gameover-newbest').hidden = !isNewBest;
  document.getElementById('gameover-title').textContent = 'Run Over';
  document.getElementById('go-rewards').innerHTML = '';
  if (isNewBest) startCelebrateLoop(); else stopCelebrateLoop();

  const runPayload = {
    score: snapshot.score, distance: snapshot.distance, coinsCollected: snapshot.coins,
    gemsCollected: snapshot.gems, keysCollected: snapshot.keys, mysteryBoxesOpened: snapshot.mysteryBoxesOpened,
    portalsUsed: snapshot.portalsUsed, powerupsUsed: snapshot.powerupsUsed, worldName: snapshot.world,
  };

  if (state.mode === 'multiplayer') {
    document.getElementById('gameover-waiting').hidden = false;
    document.getElementById('gameover-actions').hidden = true;
    multiplayer.finishRace(runPayload);
  } else {
    document.getElementById('gameover-waiting').hidden = true;
    document.getElementById('gameover-actions').hidden = false;
    const result = await api.saveRun(state.profile.id, runPayload);
    state.profile = result.profile;
    renderRewardChips(result.newlyClaimedQuests, result.newlyUnlockedAchievements, result.challengeCompleted, result.leveledUp, result.profile.level);
    await refreshProfileUI();
  }

  document.getElementById('overlay-gameover').hidden = false;
}

function startSoloRun() {
  state.mode = 'solo';
  hideMpSidebar();
  document.getElementById('mp-standings').innerHTML = '';
  showGameScreen();
  hideAllOverlays();
  const eng = ensureEngine();
  eng.setCharacter(getCharacter(state.selectedCharacterId));
  eng.startRun({
    mode: 'solo',
    seed: Math.floor(Math.random() * 2147483646) + 1,
    startWorldId: state.selectedWorldId,
    unlockedWorldIds: getUnlockedWorldIds(),
  });
}

function hideAllOverlays() {
  ['overlay-pause', 'overlay-gameover', 'overlay-results', 'overlay-countdown'].forEach((id) => {
    document.getElementById(id).hidden = true;
  });
  stopCelebrateLoop();
}

// pause / resume / restart / quit

function togglePause() {
  if (!engine || !engine.running) return;
  if (engine.paused) {
    engine.resume();
    document.getElementById('overlay-pause').hidden = true;
  } else {
    engine.pause();
    document.getElementById('overlay-pause').hidden = false;
  }
}

document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-restart').addEventListener('click', () => {
  document.getElementById('overlay-pause').hidden = true;
  if (state.mode === 'multiplayer') {
    // Multiplayer races can't be restarted solo; leave back to the room instead.
    quitToMenu();
    return;
  }
  startSoloRun();
});
document.getElementById('btn-quit').addEventListener('click', () => quitToMenu());
document.getElementById('btn-retry').addEventListener('click', () => {
  document.getElementById('overlay-gameover').hidden = true;
  startSoloRun();
});
document.getElementById('btn-gameover-menu').addEventListener('click', () => quitToMenu());

function quitToMenu() {
  if (engine) engine.destroy();
  if (state.mode === 'multiplayer') multiplayer.leaveRoom();
  hideMpSidebar();
  hideAllOverlays();
  showPage('page-home');
  refreshDashboardPanels();
}

// touch controls

document.getElementById('btn-touch-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); engine && engine.handleJump(); });
document.getElementById('btn-touch-slide').addEventListener('pointerdown', (e) => { e.preventDefault(); engine && engine.handleSlide(); });
document.getElementById('btn-touch-dash').addEventListener('pointerdown', (e) => { e.preventDefault(); engine && engine.handleDash(); });

// ------------------------------------------------------------------ multiplayer

const mpNameInput = document.getElementById('mp-name-input');
const mpCodeInput = document.getElementById('mp-code-input');
const mpError = document.getElementById('mp-error');

document.getElementById('btn-create-room').addEventListener('click', () => {
  audio.unlock();
  multiplayer.identify(state.profile.id);
  multiplayer.createRoom({ name: mpNameInput.value || state.profile.name, characterId: state.selectedCharacterId, playerId: state.profile.id });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = mpCodeInput.value.trim();
  if (!code) { showMpError('Enter a room code.'); return; }
  audio.unlock();
  multiplayer.identify(state.profile.id);
  multiplayer.joinRoom(code, { name: mpNameInput.value || state.profile.name, characterId: state.selectedCharacterId, playerId: state.profile.id });
});

function showMpError(msg) {
  mpError.textContent = msg;
  mpError.hidden = false;
}

multiplayer.on('room:error', ({ reason }) => {
  const messages = {
    not_found: 'Room not found. Check the code and try again.',
    full: 'That room is full.',
    in_progress: 'That race has already started.',
    not_host: 'Only the host can start the race.',
  };
  showMpError(messages[reason] || 'Something went wrong.');
});

multiplayer.on('room:joined', ({ code }) => {
  state.roomCode = code;
  document.getElementById('room-code').textContent = code;
  showPage('page-room');
});

multiplayer.on('room:state', (lobby) => {
  const mySocketId = multiplayer.socket.id;
  state.isHost = lobby.hostSocketId === mySocketId;
  const list = document.getElementById('room-member-list');
  list.innerHTML = '';
  lobby.members.forEach((m) => {
    const li = document.createElement('li');
    const isHost = m.socketId === lobby.hostSocketId;
    li.innerHTML = `<span>${escapeHtml(m.name)}${isHost ? '<span class="member-host">HOST</span>' : ''}</span><span class="member-ready">${m.ready ? '✔ Ready' : '…'}</span>`;
    list.appendChild(li);
    if (m.socketId === mySocketId) state.selfReady = m.ready;
  });
  document.getElementById('btn-ready').textContent = state.selfReady ? 'Not Ready' : 'Ready';
  document.getElementById('btn-start-race').hidden = !state.isHost;
  document.getElementById('btn-start-race').disabled = lobby.members.length < 1;
});

document.getElementById('btn-ready').addEventListener('click', () => {
  state.selfReady = !state.selfReady;
  multiplayer.setReady(state.selfReady);
});
document.getElementById('btn-start-race').addEventListener('click', () => multiplayer.startRace(getUnlockedWorldIds()));
document.getElementById('btn-leave-room').addEventListener('click', () => {
  multiplayer.leaveRoom();
  showPage('page-multiplayer');
});

let gameScreenActiveForCountdown = false;
multiplayer.on('room:countdown', ({ seconds }) => {
  if (!gameScreenActiveForCountdown) {
    gameScreenActiveForCountdown = true;
    state.mode = 'multiplayer';
    showGameScreen();
    hideAllOverlays();
    showMpSidebar();
    ensureEngine().setCharacter(getCharacter(state.selectedCharacterId));
  }
  document.getElementById('overlay-countdown').hidden = false;
  document.getElementById('countdown-number').textContent = seconds > 0 ? seconds : 'GO!';
  audio.countdown(seconds);
});

multiplayer.on('race:start', ({ seed, unlockedWorldIds }) => {
  gameScreenActiveForCountdown = false;
  document.getElementById('overlay-countdown').hidden = true;
  hideAllOverlays();
  // Use the host's unlocked-world set (broadcast with the race) so every racer in the
  // room shares the identical available-world pool — required for the seeded portal
  // picker to produce the same world sequence for everyone.
  ensureEngine().startRun({ mode: 'multiplayer', seed, startWorldId: state.selectedWorldId, unlockedWorldIds });
});

multiplayer.on('race:update', ({ standings }) => {
  updateStandings(standings, multiplayer.socket.id);
});

multiplayer.on('race:results', async ({ standings }) => {
  if (engine && engine.running) engine.forceStop();
  document.getElementById('overlay-gameover').hidden = true;
  renderResultsList(document.getElementById('results-list'), standings, multiplayer.socket.id);
  document.getElementById('overlay-results').hidden = false;
  // The server persisted each racer's run server-side; pull the fresh profile/quest state.
  state.profile = await api.getOrCreateProfile();
  await refreshProfileUI();
});

document.getElementById('btn-results-again').addEventListener('click', () => {
  document.getElementById('overlay-results').hidden = true;
  hideMpSidebar();
  showPage('page-room');
});
document.getElementById('btn-results-menu').addEventListener('click', () => quitToMenu());

// chat

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  multiplayer.sendChat(text);
  input.value = '';
});
multiplayer.on('chat:message', ({ name, text }) => {
  const log = document.getElementById('chat-log');
  const line = document.createElement('div');
  line.innerHTML = `<span class="chat-name">${escapeHtml(name)}:</span>${escapeHtml(text)}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
});

// --------------------------------------------------------------------- boot

async function refreshDashboardPanels() {
  renderModeList();
  renderWorldGrid();
  renderCharacterGrid('character-grid');
  await Promise.all([renderQuestsAndAchievements(), renderLeaderboard()]);
}

export async function initApp() {
  await initProfile();
  renderWorldPreviews();
  await refreshDashboardPanels();
  showPage('page-home');
  startLogoLoop();
}
