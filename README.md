# PORTAL RUSH

**One Run. Endless Worlds.**

A fully playable, polished-indie-style endless runner: portal transitions (seeded-random) between six worlds (Day/Night/Forest/Space/Volcano/Snow), coins/gems/keys/mystery boxes, seven powerups, a sixteen-character roster, an XP/level system, a Shop, daily quests, achievements, a Statistics page, a tabbed (Daily/Weekly/All-Time) leaderboard, and real-time multiplayer race rooms. Everything — art, particles, and sound — is generated procedurally on Canvas 2D and WebAudio, so there are no binary assets to download and nothing to build: clone it, `npm install`, `npm start`, and you're playing.

## Play

- **Jump**: `Space` / `↑` / `W` / on-screen ⬆ button (press again mid-air for a double jump)
- **Slide**: `↓` / `S` / on-screen ⬇ button
- **Dash**: `Shift` / `F` / on-screen ⇒ button — a short forward burst with brief invulnerability, on a per-character cooldown
- **Pause**: `P` / `Esc` / pause button

Run forward automatically, dodge obstacles, grab coins/gems/keys/mystery boxes and powerups, and cross portals to warp into a new world — each portal seeded-randomly picks the next world (never immediately repeating), looping forever with escalating difficulty.

## Architecture

**Server** (Node.js + Express + Socket.io): serves the static client and exposes a small REST API for player profiles, quests/achievements, the gem exchange, and the leaderboard, plus a Socket.io layer for multiplayer race rooms.

**Client** (vanilla JS ES modules, Canvas 2D, no bundler/build step): a deterministic, seed-based procedural level generator means every racer in a multiplayer room renders the *exact same* obstacle/coin/powerup/world-order layout from a single small `seed` integer broadcast at race start — no level data streams over the network, only live distance/score progress.

```
PORTAL RUSH/
├── server/
│   ├── index.js            Express app: static hosting + REST API + Socket.io bootstrap
│   └── socketHandlers.js   Room lifecycle: create/join/ready/countdown/race/chat over sockets
├── rooms/
│   ├── Room.js              A single race room: members, ready state, live standings
│   └── RoomManager.js       Room-code generation, create/join/leave across all rooms
├── players/
│   └── PlayerSession.js     Maps live socket connections to database player IDs; name sanitizing
├── database/
│   ├── db.js                 JSON-file-backed store (no native deps): profiles, XP/levels, gems,
│   │                          leaderboard, daily quests, achievements — see below
│   └── data/                 players.json / leaderboard.json (created/managed at runtime)
├── game/                     Client-side engine (ES modules, imported by ui/menus.js)
│   ├── engine.js              Main loop: physics, spawning, collision, powerups, scoring, rendering
│   ├── player.js               Player state machine (run/jump/slide/fly/dead), double jump, dash
│   ├── levelGenerator.js       Deterministic chunk-based obstacle/coin/gem/key/box/powerup generation
│   ├── worldRuntime.js         Maps distance → world segment; seeded-random next-world picker
│   ├── collision.js            AABB / radius collision helpers
│   └── rng.js                  Seeded PRNG (mulberry32) + per-chunk hashing
├── worlds/
│   └── worldConfig.js        6 worlds: palette + physics + ambient/obstacle theme, UMD module
├── characters/
│   └── characterConfig.js    16 characters: stats, unlock cost, procedural "look", UMD module
├── multiplayer/
│   └── client.js              Socket.io client wrapper used by the UI (rooms, race sync, chat)
├── assets/
│   ├── sprites.js             All procedural Canvas 2D drawing: runner + outfit accessories +
│   │                          celebrate pose, themed obstacles, coins/gems/keys/mystery boxes,
│   │                          powerups, portals, sun/moon/clouds/trees/planets, ambient life
│   │                          (birds/fireflies/leaves/embers/snow), particles
│   └── audio.js               WebAudio-synthesized SFX + ambient music (no audio files)
├── ui/
│   ├── index.html             App shell: a persistent sidebar (Play/Character/Worlds/Multiplayer/
│   │                          Shop/Leaderboard/Statistics/Settings) + a swappable-page main area,
│   │                          plus the fullscreen (sidebar-free) game screen during actual play
│   ├── style.css               Full neon/dark sidebar theme, responsive
│   ├── main.js                  Entry point
│   ├── menus.js                  App controller: dashboard panels, every button handler, engine + socket wiring
│   ├── hud.js                    In-run HUD DOM updates + multiplayer standings sidebar
│   ├── api.js                    REST client + local profile bootstrapping (localStorage player id)
│   └── settings.js               Persisted volume/motion settings
├── package.json
└── README.md
```

## Installation

Requires Node.js 18+.

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

For local development with auto-restart on file changes:

```bash
npm run dev
```

## Deploying it publicly

Portal Rush is a plain, stateful Node.js server (Express + Socket.io) — it needs a host that keeps a process running and supports WebSockets, so serverless/static hosts (Vercel, Netlify, GitHub Pages) won't work. [Render](https://render.com) is the easiest fit: free tier, native Node support, WebSockets work out of the box, and this repo already includes a `render.yaml` blueprint.

1. **Push this repo to GitHub** (create an empty repo at github.com/new, then from this folder):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/portal-rush.git
   git branch -M main
   git push -u origin main
   ```
2. **On Render**: New → Blueprint → connect the GitHub repo → Render reads `render.yaml` and provisions it automatically (build `npm install`, start `npm start`). First deploy takes a couple of minutes.
3. Render gives you a public URL like `https://portal-rush.onrender.com` — that's your live game.

**Know before you deploy:**
- The free plan spins the service down after 15 minutes of inactivity; the first request after that takes ~30–60s to wake it back up.
- The free plan's disk is **ephemeral** — `database/data/*.json` (player profiles, leaderboard) resets on every redeploy or restart. For a permanent leaderboard, either add a Render persistent disk mounted at `database/data` (paid), or swap `database/db.js` for a hosted database later — its read/update/query surface is small and isolated on purpose.
- Any other Node host works the same way (Railway, Fly.io, a VPS): `npm install && npm start`, with `PORT` read from the environment already.

## Gameplay systems

- **Endless runner mechanics**: fixed-lane side view, jump/slide/double-jump/dash, escalating scroll speed, obstacle density that scales both within a run and across difficulty "loops."
- **Portal transitions**: every world segment ends in a portal; crossing it triggers a radial flash + particle burst and seeded-randomly picks the next world (never immediately repeating), swapping palette/physics/ambience live.
- **Worlds**: Day, Night, Forest, Space, Volcano, Snow — each with a distinct palette, background style (city skyline, forest canopy, planets, volcanic peaks, frozen mountains + aurora), ambient life layer (birds/fireflies/drifting leaves/rising embers/falling snow), themed obstacles (cars/barriers, logs/branches, laser gates/alien pods, lava rocks/ember clusters, ice blocks/icicles), and a speed/gravity multiplier. Day and Forest are unlocked from the start; Night/Volcano/Space/Snow unlock progressively at levels 3/5/8/12 — locked worlds show a padlock in the picker and never appear in the in-run portal cycle until unlocked. In multiplayer, the whole room races using the **host's** unlocked-world set (synced at race start) so every racer sees an identical world sequence.
- **Powerups**: Speed Boost, Shield (absorbs one hit), Magnet (coin pull radius), Jetpack (temporary flight, immune to ground obstacles), Double Coin (2× coins), Invincible (temporary full immunity), Slow Motion (temporary slower scroll for tricky sections).
- **Collectibles**: Coins (currency), Gems (rarer, worth more, exchangeable for coins in the Shop), Keys (progress toward the Key Master achievement), Mystery Boxes (open into a random coin bonus, a gem, or an instant powerup).
- **Character system**: 16 characters (Doctor, Patient, Police, Normal Man, Athlete, Thief, Farmer, Engineer, Firefighter, Scientist, Teacher, Soldier, Ninja, Astronaut, Normal Woman, Student) with real stat differences (jump height, speed, slide duration, magnet radius, dash cooldown, extra jumps, a free starting shield) and a distinct procedural silhouette/outfit (helmets, masks, hats, goggles…), unlocked with banked coins via the Shop or dashboard.
- **XP & levels**: every run earns XP from distance/coins/gems (plus a bonus from the Daily Challenge); leveling up shows a toast and plays a fanfare, and unlocks new worlds. Level and XP progress are shown in the sidebar profile card.
- **Shop**: unlock characters, and exchange gems for coins (1 💎 → 20 🪙).
- **Daily quests & challenge**: 3 quests reset every calendar day (run distance, collect coins, use powerups) with coin rewards, plus a single bigger headline Daily Challenge (run 5000m) that rewards XP instead — all tracked server-side and auto-claimed the moment their target is hit.
- **Achievements**: permanent, lifetime-cumulative milestones (First Run, Coin Collector, Portal Master, Key Master, Box Opener), each worth a star, with an in-run celebration toast + sound.
- **Statistics page**: level, XP, totals (runs/distance/coins/gems/stars/keys/boxes/portals), bests, and characters unlocked, all derived from the player profile.
- **Multiplayer rooms**: create/join a 4-letter room code, ready up, host starts a synchronized countdown, then everyone races on an identical seeded level (same obstacles *and* same world order) with a live standings sidebar and in-room chat, ending in a shared results screen.
- **Persistence**: player profile (name, coins, gems, stars, XP/level, unlocks, best score/distance, quest/achievement progress) and a leaderboard (filterable Daily/Weekly/All-Time) are stored server-side in `database/data/*.json`.

## Notes on the art/audio approach

There are no image or audio files anywhere in the repo. Every visual (runner + per-character outfit accessories + celebration pose, themed obstacles, coins/gems/keys/mystery boxes, powerups, portals, particles, parallax skylines, sun/moon/clouds/trees/planets, ambient wildlife) is drawn with Canvas 2D primitives in `assets/sprites.js`, and every sound is synthesized at runtime with WebAudio oscillators/noise in `assets/audio.js`. This is a deliberate style choice (clean flat-vector look) that also guarantees the game is 100% playable immediately after `npm install` with nothing extra to fetch. It is **not** raster/illustrated "HD" character art, and this is a browser-based HTML5 game, not a compiled Play Store/App Store binary — see the note at the top of this conversation for that constraint.
