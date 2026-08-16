/** Persisted local settings (volume, motion) — independent of the server player profile. */

const KEY = 'pr_settings';
const DEFAULTS = { sfxVolume: 0.7, musicVolume: 0.35, muted: false, reducedMotion: false };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
