/** REST client for the player profile / leaderboard API, plus local profile bootstrapping. */

const PLAYER_ID_KEY = 'pr_player_id';

/**
 * API origin. Empty in the browser (the server serves this page, so relative
 * URLs work). The Android build injects the deployed origin here because the
 * app is served from a local WebView and has no server of its own.
 */
const API_BASE = (typeof window !== 'undefined' && window.PR_SERVER) || '';
const url = (p) => `${API_BASE}${p}`;

async function json(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body });
  }
  return res.json();
}

export async function getOrCreateProfile() {
  const existingId = localStorage.getItem(PLAYER_ID_KEY);
  if (existingId) {
    try {
      return await json(await fetch(url(`/api/player/${existingId}`)));
    } catch (err) {
      // Falls through to create a fresh profile if the saved id is stale/missing server-side.
    }
  }
  const profile = await json(await fetch(url('/api/player'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Runner${Math.floor(Math.random() * 9000 + 1000)}` }),
  }));
  localStorage.setItem(PLAYER_ID_KEY, profile.id);
  return profile;
}

export async function renamePlayer(id, name) {
  return json(await fetch(url(`/api/player/${id}/rename`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }));
}

export async function selectCharacter(id, characterId) {
  return json(await fetch(url(`/api/player/${id}/select-character`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId }),
  }));
}

export async function unlockCharacter(id, characterId) {
  const res = await fetch(url(`/api/player/${id}/unlock-character`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.ok, ...body };
}

export async function exchangeGems(id, gemCount) {
  const res = await fetch(url(`/api/player/${id}/exchange-gems`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gemCount }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.ok, ...body };
}

export async function selectWorld(id, worldId) {
  return json(await fetch(url(`/api/player/${id}/select-world`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worldId }),
  }));
}

/** Returns { profile, newlyUnlockedAchievements, newlyClaimedQuests }. */
export async function saveRun(id, payload) {
  return json(await fetch(url(`/api/player/${id}/save-run`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function getQuests(id) {
  return json(await fetch(url(`/api/player/${id}/quests`)));
}

export async function getLeaderboard(limit = 10, range = 'all') {
  return json(await fetch(url(`/api/leaderboard?limit=${limit}&range=${range}`)));
}
