/**
 * Tiny synthesized sound engine (WebAudio oscillators/noise), so PORTAL RUSH
 * ships with real audio feedback without bundling any audio files. Volumes
 * are user-controlled via settings (persisted in localStorage) and read by
 * whoever calls into this module.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicNodes = null;
    this.settings = { sfxVolume: 0.7, musicVolume: 0.35, muted: false };
  }

  _ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfxVolume;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.musicVolume;
    this.musicGain.connect(this.master);
    this.master.gain.value = this.settings.muted ? 0 : 1;
  }

  /** Must be called from a user gesture (button click) to satisfy autoplay policies. */
  unlock() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSfxVolume(v) {
    this.settings.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMusicVolume(v) {
    this.settings.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setMuted(muted) {
    this.settings.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  _tone({ freq, duration, type = 'sine', gain = 0.22, slideTo = null, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noise({ duration, gain = 0.18, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
  }

  jump() { this._tone({ freq: 420, slideTo: 780, duration: 0.16, type: 'square', gain: 0.18 }); }
  doubleJump() { this._tone({ freq: 560, slideTo: 1040, duration: 0.14, type: 'square', gain: 0.2 }); }
  dash() {
    this._tone({ freq: 200, slideTo: 60, duration: 0.12, type: 'sawtooth', gain: 0.2 });
    this._noise({ duration: 0.15, gain: 0.14 });
  }
  slide() { this._tone({ freq: 220, slideTo: 90, duration: 0.14, type: 'sawtooth', gain: 0.15 }); }
  coin() { this._tone({ freq: 900, slideTo: 1500, duration: 0.12, type: 'square', gain: 0.16 }); }
  powerup() {
    this._tone({ freq: 300, slideTo: 900, duration: 0.28, type: 'triangle', gain: 0.2 });
    this._tone({ freq: 450, slideTo: 1200, duration: 0.28, type: 'triangle', gain: 0.12, delay: 0.05 });
  }
  portal() {
    this._tone({ freq: 120, slideTo: 40, duration: 0.6, type: 'sawtooth', gain: 0.22 });
    this._noise({ duration: 0.5, gain: 0.12 });
  }
  hit() {
    this._tone({ freq: 180, slideTo: 40, duration: 0.35, type: 'sawtooth', gain: 0.28 });
    this._noise({ duration: 0.3, gain: 0.22 });
  }
  gem() {
    this._tone({ freq: 1100, slideTo: 1800, duration: 0.18, type: 'sine', gain: 0.18 });
    this._tone({ freq: 1400, slideTo: 2200, duration: 0.16, type: 'sine', gain: 0.1, delay: 0.04 });
  }
  key() { this._tone({ freq: 700, slideTo: 1100, duration: 0.14, type: 'triangle', gain: 0.16 }); }
  mysteryBox() {
    this._tone({ freq: 260, slideTo: 700, duration: 0.22, type: 'square', gain: 0.18 });
    this._tone({ freq: 520, slideTo: 1300, duration: 0.22, type: 'square', gain: 0.14, delay: 0.06 });
  }
  levelUp() {
    this._tone({ freq: 440, duration: 0.15, type: 'triangle', gain: 0.2 });
    this._tone({ freq: 660, duration: 0.15, type: 'triangle', gain: 0.2, delay: 0.12 });
    this._tone({ freq: 880, duration: 0.3, type: 'triangle', gain: 0.22, delay: 0.24 });
  }
  achievement() {
    this._tone({ freq: 520, slideTo: 780, duration: 0.2, type: 'triangle', gain: 0.2 });
    this._tone({ freq: 780, slideTo: 1040, duration: 0.25, type: 'triangle', gain: 0.18, delay: 0.1 });
  }
  click() { this._tone({ freq: 500, duration: 0.06, type: 'square', gain: 0.12 }); }
  countdown(beat) { this._tone({ freq: beat === 0 ? 880 : 520, duration: 0.18, type: 'square', gain: 0.2 }); }

  /** Soft ambient drone loop; recolored per-world by `hue` (a base frequency). */
  startMusic(baseFreq = 110) {
    this._ensureContext();
    this.stopMusic();
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq * 1.5;
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.musicGain);
    osc1.start();
    osc2.start();
    lfo.start();
    this.musicNodes = [osc1, osc2, lfo];
  }

  setMusicBaseFreq(baseFreq) {
    if (!this.musicNodes) return;
    const [osc1, osc2] = this.musicNodes;
    const t = this.ctx.currentTime;
    osc1.frequency.linearRampToValueAtTime(baseFreq, t + 1.2);
    osc2.frequency.linearRampToValueAtTime(baseFreq * 1.5, t + 1.2);
  }

  stopMusic() {
    if (!this.musicNodes) return;
    for (const n of this.musicNodes) {
      try { n.stop(); } catch (e) { /* already stopped */ }
    }
    this.musicNodes = null;
  }
}

export const audio = new AudioEngine();
