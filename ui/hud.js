/** DOM updates for the in-run HUD: score/coins/distance, powerup chips, and the multiplayer sidebar. */

const POWERUP_LABELS = {
  magnet: '🧲 Magnet', doubleCoin: '×2 Coins', speed: '⚡ Speed',
  jetpack: '🚀 Jetpack', invincible: '★ Invincible', slowMotion: '◷ Slow-Mo',
};

const el = {
  score: document.getElementById('hud-score'),
  coins: document.getElementById('hud-coins'),
  gems: document.getElementById('hud-gems'),
  keys: document.getElementById('hud-keys'),
  distance: document.getElementById('hud-distance'),
  world: document.getElementById('hud-world'),
  powerups: document.getElementById('hud-powerups'),
  mpSidebar: document.getElementById('mp-sidebar'),
  mpStandings: document.getElementById('mp-standings'),
};

export function updateHud(snapshot) {
  el.score.textContent = snapshot.score.toLocaleString();
  el.coins.textContent = snapshot.coins;
  el.gems.textContent = snapshot.gems;
  el.keys.textContent = snapshot.keys;
  el.distance.textContent = snapshot.distance;
  el.world.textContent = snapshot.world;

  el.powerups.innerHTML = '';
  for (const [kind, remaining] of Object.entries(snapshot.activePowerups)) {
    if (remaining > 0 && POWERUP_LABELS[kind]) {
      const chip = document.createElement('span');
      chip.className = 'powerup-chip';
      chip.textContent = `${POWERUP_LABELS[kind]} ${remaining.toFixed(1)}s`;
      el.powerups.appendChild(chip);
    }
  }
}

export function showMpSidebar() {
  el.mpSidebar.hidden = false;
}

export function hideMpSidebar() {
  el.mpSidebar.hidden = true;
}

export function updateStandings(standings, selfSocketId) {
  el.mpStandings.innerHTML = '';
  standings.forEach((s, i) => {
    const li = document.createElement('li');
    if (s.socketId === selfSocketId) li.classList.add('self');
    if (!s.alive) li.classList.add('dead');
    li.innerHTML = `<span>#${i + 1} ${escapeHtml(s.name)}</span><span>${s.score}</span>`;
    el.mpStandings.appendChild(li);
  });
}

export function renderResultsList(container, standings, selfSocketId) {
  container.innerHTML = '';
  standings.forEach((s, i) => {
    const li = document.createElement('li');
    if (s.socketId === selfSocketId) li.classList.add('self');
    li.innerHTML = `<span>#${i + 1} ${escapeHtml(s.name)}</span><span>${s.score} pts · ${s.distance}m</span>`;
    container.appendChild(li);
  });
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
