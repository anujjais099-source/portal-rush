import { Player, PLAYER_WIDTH, PLAYER_HEIGHT, SLIDE_HEIGHT, DASH_DISTANCE } from './player.js';
import { generateChunk, CHUNK_SIZE } from './levelGenerator.js';
import { WorldRuntime } from './worldRuntime.js';
import { playerHitsObstacle, withinPickupRadius } from './collision.js';
import {
  drawRunner, drawObstacle, drawCoin, drawGem, drawKey, drawMysteryBox, drawPowerupIcon, drawPortal, ParticleSystem,
  drawSun, drawMoon, drawCloud, drawTree, drawPlanet, drawAmbientLayer,
} from '../assets/sprites.js';
import { audio } from '../assets/audio.js';

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
const GROUND_Y = 400;
const PLAYER_SCREEN_X = 190;
const BASE_SPEED = 330;
const LOOKAHEAD_PX = 1500;
const BEHIND_TRIM_PX = 260;
const BASE_COIN_RADIUS = 46;
const MAGNET_RADIUS = 150;
const SCORE_PER_WORLD_UNIT = 0.12;
const COIN_SCORE = 15;
const GEM_SCORE = 60;
const MYSTERY_REWARDS = ['coins', 'coins', 'gem', 'powerup'];
const POWERUP_DURATIONS = { magnet: 6, doubleCoin: 8, speed: 5, jetpack: 6, invincible: 6, slowMotion: 5 };
const AURA_COLORS = { shield: '#4fd1ff', invincible: '#b46bff', jetpack: '#ff8a3d' };

/**
 * The whole runnable game: physics, procedural spawning, collision,
 * rendering, and scoring. Single-player and multiplayer share this exact
 * class - multiplayer just supplies a server-issued `seed` and reads
 * `getSnapshot()` periodically to relay progress over the socket.
 */
export class Engine {
  constructor(canvas, callbacks = {}, settings = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks; // { onHud, onGameOver, onWorldChange, onPortal, onPauseRequested }
    this.settings = settings; // { reducedMotion }
    this.particles = new ParticleSystem();
    this._raf = null;
    this._lastTs = 0;
    this.paused = false;
    this.running = false;
    this._hudAccumulator = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._loop = this._loop.bind(this);
  }

  setCharacter(character) {
    this.character = character;
  }

  startRun({ seed = Date.now() % 2147483647, mode = 'solo', startWorldId = null, unlockedWorldIds = null } = {}) {
    this.seed = seed;
    this.mode = mode;
    const worlds = (typeof window !== 'undefined' && window.PR_WORLDS) || [];
    const startIndex = startWorldId ? Math.max(0, worlds.findIndex((w) => w.id === startWorldId)) : 0;
    const availableIndices = unlockedWorldIds
      ? worlds.map((w, i) => (unlockedWorldIds.includes(w.id) ? i : -1)).filter((i) => i >= 0)
      : null;
    this.worldRuntime = new WorldRuntime(startIndex, seed, availableIndices);
    this.player = new Player(this.character);
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.gems = 0;
    this.keys = 0;
    this.mysteryBoxesOpened = 0;
    this.portalsUsed = 0;
    this.powerupsUsed = 0;
    this.activePowerups = { magnet: 0, doubleCoin: 0, speed: 0, jetpack: 0, invincible: 0, slowMotion: 0 };
    this.chunks = new Map();
    this.currentWorldId = null;
    this.portalFlash = 0;
    this.shakeTimer = 0;
    this.particles.clear();
    this.paused = false;
    this.running = true;
    this._lastTs = 0;

    window.addEventListener('keydown', this._onKeyDown);
    this._ensureChunks();

    const cfg = this.worldRuntime.configAt(0);
    this.currentWorldId = cfg.id;
    audio.startMusic(this._worldBaseFreq(cfg));
    if (this.callbacks.onWorldChange) this.callbacks.onWorldChange(cfg);

    this._raf = requestAnimationFrame(this._loop);
  }

  destroy() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    audio.stopMusic();
  }

  /** Stops the loop without firing onGameOver — used when a multiplayer race is settled externally. */
  forceStop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    audio.stopMusic();
  }

  pause() {
    if (!this.running) return;
    this.paused = true;
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this._lastTs = 0;
  }

  togglePause() {
    this.paused ? this.resume() : this.pause();
  }

  handleJump() {
    if (!this.running || this.paused || !this.player || !this.player.alive) return;
    this.player.jump(audio);
  }

  handleSlide() {
    if (!this.running || this.paused || !this.player || !this.player.alive) return;
    this.player.slide(audio);
  }

  handleDash() {
    if (!this.running || this.paused || !this.player || !this.player.alive) return;
    if (this.player.dash(audio)) {
      const sx = PLAYER_SCREEN_X;
      this.distance += DASH_DISTANCE;
      this.particles.burst(sx, GROUND_Y - this.player.y - PLAYER_HEIGHT / 2, this.character.accent, 16, { speed: 300, life: 0.4 });
    }
  }

  _onKeyDown(e) {
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
      e.preventDefault();
      this.handleJump();
    } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
      e.preventDefault();
      this.handleSlide();
    } else if (['ShiftLeft', 'ShiftRight', 'KeyF'].includes(e.code)) {
      e.preventDefault();
      this.handleDash();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (this.callbacks.onPauseRequested) this.callbacks.onPauseRequested();
    }
  }

  _worldBaseFreq(cfg) {
    const table = {
      'day-mode': 130, 'night-mode': 98, 'forest-mode': 116, 'space-mode': 82,
      'volcano-mode': 70, 'snow-mode': 150,
    };
    return table[cfg.id] || 110;
  }

  _ensureChunks() {
    const first = Math.max(0, Math.floor((this.distance - BEHIND_TRIM_PX) / CHUNK_SIZE));
    const last = Math.ceil((this.distance + LOOKAHEAD_PX) / CHUNK_SIZE);
    for (let i = first; i <= last; i++) {
      if (this.chunks.has(i)) continue;
      const cfg = this.worldRuntime.configAt(i * CHUNK_SIZE);
      this.chunks.set(i, generateChunk(this.seed, i, cfg.effectiveDensity));
    }
    for (const idx of [...this.chunks.keys()]) {
      if (idx < first) this.chunks.delete(idx);
    }
  }

  _forEachActive(kind, fn) {
    for (const chunk of this.chunks.values()) {
      for (const item of chunk[kind]) fn(item);
    }
  }

  _currentSpeed(cfg) {
    const ramp = 1 + Math.min(0.5, this.distance / 12000);
    const speedBoost = this.activePowerups.speed > 0 ? 1.35 : 1;
    const slowMo = this.activePowerups.slowMotion > 0 ? 0.55 : 1;
    return BASE_SPEED * cfg.effectiveSpeedMultiplier * this.character.stats.speed * ramp * speedBoost * slowMo;
  }

  _loop(ts) {
    if (!this.running) return;
    if (!this._lastTs) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    dt = Math.min(dt, 1 / 20); // clamp to avoid huge steps after tab-switch

    if (!this.paused) this.update(dt);
    this.render();
    this._raf = requestAnimationFrame(this._loop);
  }

  update(dt) {
    const cfg = this.worldRuntime.configAt(this.distance);
    if (cfg.id !== this.currentWorldId) {
      this.currentWorldId = cfg.id;
      audio.setMusicBaseFreq(this._worldBaseFreq(cfg));
      if (this.callbacks.onWorldChange) this.callbacks.onWorldChange(cfg);
    }

    for (const key of Object.keys(this.activePowerups)) {
      if (this.activePowerups[key] > 0) this.activePowerups[key] = Math.max(0, this.activePowerups[key] - dt);
    }
    this.player.setJetpack(this.activePowerups.jetpack > 0);
    this.player.invincible = this.activePowerups.invincible > 0;

    if (this.player.alive) {
      const speed = this._currentSpeed(cfg);
      this.distance += speed * dt;
      this.player.update(dt, cfg.gravityMultiplier);

      this.score += speed * dt * SCORE_PER_WORLD_UNIT;

      this._ensureChunks();
      this._resolveCollisions();
      this._checkPortal(cfg);
    }

    this.particles.update(dt);
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
    if (this.portalFlash > 0) this.portalFlash -= dt;

    this._hudAccumulator += dt;
    if (this._hudAccumulator >= 0.1) {
      this._hudAccumulator = 0;
      if (this.callbacks.onHud) this.callbacks.onHud(this.getSnapshot());
    }
  }

  _resolveCollisions() {
    const hb = this.player.hitbox;
    const magnetActive = this.activePowerups.magnet > 0;
    const coinRadius = magnetActive ? MAGNET_RADIUS : BASE_COIN_RADIUS;
    const coinFactor = this.activePowerups.doubleCoin > 0 ? 2 : 1;

    this._forEachActive('obstacles', (ob) => {
      if (ob.hit) return;
      if (playerHitsObstacle(hb, this.distance, ob)) {
        ob.hit = true;
        const died = this.player.hit(audio);
        if (died || !this.player.alive) {
          this.shakeTimer = 0.3;
          this.particles.burst(PLAYER_SCREEN_X, GROUND_Y - hb.top - hb.height / 2, '#ff4d6d', 22, { speed: 260, life: 0.5 });
        }
        if (died) this._onDeath();
      }
    });

    this._forEachActive('coins', (coin) => {
      if (coin.collected) return;
      if (withinPickupRadius(coin.x, coin.heightAboveGround, this.distance, this.player.y, coinRadius)) {
        coin.collected = true;
        this.coins += coinFactor;
        this.score += COIN_SCORE * coinFactor;
        audio.coin();
        const sx = PLAYER_SCREEN_X + (coin.x - this.distance);
        this.particles.burst(sx, GROUND_Y - coin.heightAboveGround, '#ffd83d', 8, { speed: 140, life: 0.35, size: 3 });
      }
    });

    this._forEachActive('gems', (gem) => {
      if (gem.collected) return;
      if (withinPickupRadius(gem.x, gem.heightAboveGround, this.distance, this.player.y, coinRadius)) {
        gem.collected = true;
        this.gems += 1;
        this.score += GEM_SCORE;
        audio.gem();
        const sx = PLAYER_SCREEN_X + (gem.x - this.distance);
        this.particles.burst(sx, GROUND_Y - gem.heightAboveGround, '#4fd1ff', 12, { speed: 180, life: 0.45, size: 4 });
      }
    });

    this._forEachActive('keys', (key) => {
      if (key.collected) return;
      if (withinPickupRadius(key.x, key.heightAboveGround, this.distance, this.player.y, BASE_COIN_RADIUS)) {
        key.collected = true;
        this.keys += 1;
        audio.key();
        const sx = PLAYER_SCREEN_X + (key.x - this.distance);
        this.particles.burst(sx, GROUND_Y - key.heightAboveGround, '#ffd83d', 10, { speed: 160, life: 0.4 });
      }
    });

    this._forEachActive('mysteryBoxes', (box) => {
      if (box.collected) return;
      if (withinPickupRadius(box.x, box.heightAboveGround, this.distance, this.player.y, BASE_COIN_RADIUS + 10)) {
        box.collected = true;
        this.mysteryBoxesOpened += 1;
        this._openMysteryBox(box);
        const sx = PLAYER_SCREEN_X + (box.x - this.distance);
        this.particles.burst(sx, GROUND_Y - box.heightAboveGround, '#c86bff', 22, { speed: 240, life: 0.55 });
      }
    });

    this._forEachActive('powerups', (p) => {
      if (p.collected) return;
      if (withinPickupRadius(p.x, p.heightAboveGround, this.distance, this.player.y, BASE_COIN_RADIUS + 10)) {
        p.collected = true;
        this._applyPowerup(p.kind);
        this.powerupsUsed += 1;
        audio.powerup();
        const sx = PLAYER_SCREEN_X + (p.x - this.distance);
        this.particles.burst(sx, GROUND_Y - p.heightAboveGround, '#4fd1ff', 16, { speed: 200, life: 0.5 });
      }
    });
  }

  _openMysteryBox(box) {
    const reward = MYSTERY_REWARDS[Math.floor(Math.random() * MYSTERY_REWARDS.length)];
    audio.mysteryBox();
    if (reward === 'gem') {
      this.gems += 1;
      this.score += GEM_SCORE;
    } else if (reward === 'powerup') {
      const kinds = Object.keys(POWERUP_DURATIONS);
      this._applyPowerup(kinds[Math.floor(Math.random() * kinds.length)]);
    } else {
      const bonus = 20 + Math.floor(Math.random() * 60);
      this.coins += bonus;
      this.score += bonus;
    }
  }

  _applyPowerup(kind) {
    if (kind === 'shield') {
      this.player.grantShield();
      return;
    }
    this.activePowerups[kind] = POWERUP_DURATIONS[kind] || 5;
  }

  _checkPortal(cfg) {
    const toPortal = cfg.portalAt - this.distance;
    if (toPortal < 0 && !this._justPortaled) {
      this._justPortaled = true;
      this.portalsUsed += 1;
      this.portalFlash = 0.9;
      audio.portal();
      this.particles.burst(PLAYER_SCREEN_X, GROUND_Y - 60, cfg.particle, 40, { speed: 320, life: 0.8, size: 5 });
      if (this.callbacks.onPortal) this.callbacks.onPortal(this.worldRuntime.configAt(this.distance));
    } else if (toPortal > 50) {
      this._justPortaled = false;
    }
  }

  _onDeath() {
    this.running = false;
    window.removeEventListener('keydown', this._onKeyDown);
    audio.stopMusic();
    if (this.callbacks.onGameOver) {
      this.callbacks.onGameOver(this.getSnapshot());
    }
  }

  getSnapshot() {
    const cfg = this.worldRuntime ? this.worldRuntime.configAt(this.distance) : null;
    return {
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      coins: this.coins,
      gems: this.gems,
      keys: this.keys,
      mysteryBoxesOpened: this.mysteryBoxesOpened,
      alive: this.player ? this.player.alive : false,
      world: cfg ? cfg.name : '',
      worldId: cfg ? cfg.id : '',
      activePowerups: { ...this.activePowerups },
      distanceToPortal: this.worldRuntime ? Math.max(0, this.worldRuntime.distanceToPortal(this.distance)) : 0,
      portalsUsed: this.portalsUsed,
      powerupsUsed: this.powerupsUsed,
      dashReady: this.player ? this.player.dashCooldownRemaining <= 0 : true,
      dashCooldownRemaining: this.player ? Math.max(0, this.player.dashCooldownRemaining) : 0,
    };
  }

  // ---------------------------------------------------------------- render

  render() {
    const ctx = this.ctx;
    const cfg = this.worldRuntime.configAt(this.distance);
    ctx.save();

    if (this.shakeTimer > 0 && !this.settings.reducedMotion) {
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    }

    this._drawSky(ctx, cfg);
    this._drawGround(ctx, cfg);
    this._drawPortalAhead(ctx, cfg);
    this._drawEntities(ctx, cfg);
    this._drawPlayer(ctx);
    this.particles.draw(ctx);

    if (this.portalFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.portalFlash) * (this.settings.reducedMotion ? 0.15 : 0.5);
      const grad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7
      );
      grad.addColorStop(0, cfg.particle);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    if (this.paused) {
      ctx.fillStyle = 'rgba(3,4,12,0.55)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.restore();
  }

  _drawSky(ctx, cfg) {
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, cfg.sky[0]);
    grad.addColorStop(0.55, cfg.sky[1]);
    grad.addColorStop(1, cfg.sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

    if (cfg.celestial === 'sun') drawSun(ctx, 800, 90, 46);
    if (cfg.celestial === 'moon') drawMoon(ctx, 800, 80, 38);

    if (cfg.skylineStyle === 'city-day') {
      const cloudOffset = (this.distance * 0.05) % 400;
      for (let i = -1; i < 4; i++) drawCloud(ctx, i * 400 - cloudOffset + 200, 70 + (i % 2) * 40, 1.4);
    } else if (cfg.skylineStyle === 'city-night' || cfg.skylineStyle === 'snow') {
      // Slow-drifting starfield for night/cold skies so the upper sky never reads as empty.
      const starOffset = (this.distance * 0.03) % 220;
      ctx.fillStyle = '#ffffff';
      for (let i = -1; i < 10; i++) {
        for (let j = 0; j < 4; j++) {
          const sx = i * 220 + j * 53 - starOffset;
          const sy = 20 + ((j * 91 + i * 37) % (GROUND_Y - 140));
          const twinkle = 0.35 + 0.5 * Math.abs(Math.sin(this.player.animClock * 2 + i * 3 + j));
          ctx.globalAlpha = twinkle;
          ctx.fillRect(sx, sy, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
      if (cfg.skylineStyle === 'snow') this._drawAurora(ctx);
    } else if (cfg.skylineStyle === 'volcano') {
      // Rising heat/smoke haze bands instead of stars.
      for (let i = 0; i < 4; i++) {
        const sy = 60 + i * 70 + Math.sin(this.player.animClock * 0.6 + i) * 8;
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#3a1a10';
        ctx.fillRect(0, sy, CANVAS_WIDTH, 26);
      }
      ctx.globalAlpha = 1;
    }

    drawAmbientLayer(ctx, cfg.ambient, this.distance, this.player.animClock, CANVAS_WIDTH, GROUND_Y);

    if (cfg.skylineStyle === 'space') {
      const starOffset = (this.distance * 0.03) % 220;
      ctx.fillStyle = '#ffffff';
      for (let i = -1; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          const sx = i * 220 + j * 43 - starOffset;
          const sy = 15 + ((j * 91 + i * 37) % (GROUND_Y - 100));
          ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(this.player.animClock * 2 + i * 3 + j));
          ctx.fillRect(sx, sy, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
      const planetOffset = (this.distance * 0.07) % 500;
      const planetColors = ['#ff8fd0', '#8fd0ff', '#ffd08f'];
      for (let i = -1; i < 3; i++) {
        drawPlanet(ctx, i * 500 - planetOffset + 250, 100 + (i % 2) * 70, 26 + (i % 2) * 10, planetColors[Math.abs(i) % 3], i % 2 === 0);
      }
    } else if (cfg.skylineStyle === 'forest') {
      const treeOffset = (this.distance * 0.15) % 140;
      for (let i = -1; i < 9; i++) {
        const tx = i * 140 - treeOffset;
        const th = 100 + ((i * 37) % 60);
        drawTree(ctx, tx, GROUND_Y, th, i % 2 === 0 ? '#2f8f5f' : '#3aa86e', '#4a2f1a');
      }
    } else if (cfg.skylineStyle === 'volcano') {
      // Jagged volcanic peaks with a glowing lava vein and a drifting smoke plume.
      const peakOffset = (this.distance * 0.12) % 220;
      for (let i = -1; i < 6; i++) {
        const px = i * 220 - peakOffset;
        const ph = 90 + ((i * 41) % 70);
        ctx.fillStyle = '#1e0a06';
        ctx.beginPath();
        ctx.moveTo(px, GROUND_Y);
        ctx.lineTo(px + 60, GROUND_Y - ph);
        ctx.lineTo(px + 120, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ff6a1a';
        ctx.globalAlpha = 0.7 + Math.sin(this.player.animClock * 3 + i) * 0.2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px + 60, GROUND_Y - ph);
        ctx.lineTo(px + 45, GROUND_Y - ph * 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(60,50,50,0.3)';
        ctx.beginPath();
        ctx.ellipse(px + 55, GROUND_Y - ph - 20 - Math.sin(this.player.animClock + i) * 6, 26, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cfg.skylineStyle === 'snow') {
      // Frozen mountain range with icy highlights.
      const peakOffset = (this.distance * 0.12) % 200;
      for (let i = -1; i < 7; i++) {
        const px = i * 200 - peakOffset;
        const ph = 70 + ((i * 33) % 60);
        ctx.fillStyle = '#8fb8d8';
        ctx.beginPath();
        ctx.moveTo(px, GROUND_Y);
        ctx.lineTo(px + 55, GROUND_Y - ph);
        ctx.lineTo(px + 110, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(px + 55, GROUND_Y - ph);
        ctx.lineTo(px + 40, GROUND_Y - ph * 0.55);
        ctx.lineTo(px + 68, GROUND_Y - ph * 0.55);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // City skyline (day/night): parallax buildings with lit windows.
      const parallaxOffset = (this.distance * 0.15) % 180;
      for (let i = -1; i < 7; i++) {
        const bx = i * 180 - parallaxOffset;
        const bh = 60 + ((i * 53) % 90);
        ctx.fillStyle = `${cfg.ground}cc`;
        ctx.fillRect(bx, GROUND_Y - bh, 90, bh);
        ctx.strokeStyle = `${cfg.accent}33`;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, GROUND_Y - bh, 90, bh);

        ctx.fillStyle = cfg.accent;
        for (let w = 0; w < 5; w++) {
          const wx = bx + 10 + (w % 3) * 24;
          const wy = GROUND_Y - bh + 10 + Math.floor(w / 3) * 20;
          if (wy < GROUND_Y - 8) {
            ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(this.player.animClock + w + i));
            ctx.fillRect(wx, wy, 5, 5);
          }
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  _drawAurora(ctx) {
    const colors = ['rgba(140,255,200,0.18)', 'rgba(140,200,255,0.14)', 'rgba(220,140,255,0.12)'];
    for (let band = 0; band < 3; band++) {
      ctx.strokeStyle = colors[band];
      ctx.lineWidth = 18;
      ctx.beginPath();
      for (let x = 0; x <= CANVAS_WIDTH; x += 20) {
        const y = 50 + band * 22 + Math.sin(x * 0.01 + this.player.animClock * 0.8 + band) * 18;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  _drawGround(ctx, cfg) {
    ctx.fillStyle = cfg.ground;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    ctx.strokeStyle = cfg.groundLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    ctx.strokeStyle = `${cfg.groundLine}55`;
    ctx.lineWidth = 2;
    const segment = 40;
    const offset = this.distance % segment;
    for (let x = -offset; x < CANVAS_WIDTH; x += segment) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 14);
      ctx.lineTo(x + 18, GROUND_Y + 14);
      ctx.stroke();
    }
  }

  _drawPortalAhead(ctx, cfg) {
    const toPortal = cfg.portalAt - this.distance;
    if (toPortal > 0 && toPortal < 900) {
      const sx = PLAYER_SCREEN_X + toPortal;
      if (sx < CANVAS_WIDTH + 100) {
        drawPortal(ctx, sx, GROUND_Y - 90, 150, this.player.animClock, cfg.particle);
      }
    }
  }

  _drawEntities(ctx, cfg) {
    this._forEachActive('coins', (coin) => {
      if (coin.collected) return;
      const sx = PLAYER_SCREEN_X + (coin.x - this.distance);
      if (sx < -30 || sx > CANVAS_WIDTH + 30) return;
      drawCoin(ctx, sx, GROUND_Y - coin.heightAboveGround, 11, this.player.animClock + coin.x * 0.01);
    });

    this._forEachActive('gems', (gem) => {
      if (gem.collected) return;
      const sx = PLAYER_SCREEN_X + (gem.x - this.distance);
      if (sx < -30 || sx > CANVAS_WIDTH + 30) return;
      drawGem(ctx, sx, GROUND_Y - gem.heightAboveGround, 11, this.player.animClock + gem.x * 0.01);
    });

    this._forEachActive('keys', (key) => {
      if (key.collected) return;
      const sx = PLAYER_SCREEN_X + (key.x - this.distance);
      if (sx < -30 || sx > CANVAS_WIDTH + 30) return;
      drawKey(ctx, sx, GROUND_Y - key.heightAboveGround, 11, this.player.animClock);
    });

    this._forEachActive('mysteryBoxes', (box) => {
      if (box.collected) return;
      const sx = PLAYER_SCREEN_X + (box.x - this.distance);
      if (sx < -30 || sx > CANVAS_WIDTH + 30) return;
      drawMysteryBox(ctx, sx, GROUND_Y - box.heightAboveGround, 14, this.player.animClock);
    });

    this._forEachActive('powerups', (p) => {
      if (p.collected) return;
      const sx = PLAYER_SCREEN_X + (p.x - this.distance);
      if (sx < -30 || sx > CANVAS_WIDTH + 30) return;
      drawPowerupIcon(ctx, p.kind, sx, GROUND_Y - p.heightAboveGround, 16, this.player.animClock);
    });

    this._forEachActive('obstacles', (ob) => {
      if (ob.hit) return;
      const sx = PLAYER_SCREEN_X + (ob.x - this.distance);
      if (sx < -120 || sx > CANVAS_WIDTH + 120) return;
      ob.screenX = sx;
      drawObstacle(ctx, ob, GROUND_Y, cfg.obstacle, cfg.obstacleTheme, this.player.animClock);
    });
  }

  _drawPlayer(ctx) {
    const p = this.player;
    const visualState = p.jetpackActive ? 'fly' : p.state;
    const glow = p.invincible ? AURA_COLORS.invincible : null;
    drawRunner(ctx, {
      x: PLAYER_SCREEN_X,
      y: GROUND_Y - p.y,
      width: PLAYER_WIDTH,
      height: p.state === 'slide' ? SLIDE_HEIGHT : PLAYER_HEIGHT,
      color: this.character.color,
      accent: this.character.accent,
      state: visualState,
      t: p.animClock,
      invulnerable: p.invulnerableTimer > 0,
      dashing: p.dashing,
      glow,
      look: this.character.look,
    });
    if (p.shield) this._drawAura(ctx, AURA_COLORS.shield);
    if (p.jetpackActive) this._drawAura(ctx, AURA_COLORS.jetpack);
  }

  _drawAura(ctx, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(PLAYER_SCREEN_X + 4, GROUND_Y - this.player.y - PLAYER_HEIGHT / 2, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
