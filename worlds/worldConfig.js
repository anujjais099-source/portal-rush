/**
 * PORTAL RUSH - world roster.
 *
 * UMD-style module (see characters/characterConfig.js for the pattern).
 * Each world is a full palette + physics modifier, not just a re-skin:
 * speedMultiplier and gravityMultiplier change how the run actually feels.
 * Worlds are traversed with a seeded pick each portal crossing, restricted
 * to whichever worlds the player has unlocked (see game/worldRuntime.js),
 * and loop forever with an escalating difficulty factor.
 *
 * `unlockLevel` gates the world from the "Choose Your Run" picker and from
 * the in-run portal cycle until the player reaches that account level.
 * `skylineStyle` picks which background silhouette generator engine.js uses,
 * `celestial` picks the sun/moon drawn in the sky, `ambient` picks the
 * looping ambient-life particle layer (birds/fireflies/leaves/embers/snow),
 * and `obstacleTheme` picks which themed obstacle sprites render in that
 * world (see assets/sprites.js drawObstacle).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PR_WORLDS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const WORLDS = [
    {
      id: 'day-mode',
      name: 'Day Mode',
      tagline: 'Run endless. Beat your best.',
      icon: '☀️',
      unlockLevel: 1,
      distanceToNext: 700,
      sky: ['#2f8fdc', '#6fc0f0', '#dff2ff'],
      ground: '#5a7a4a',
      groundLine: '#e8f7ff',
      accent: '#ffe066',
      obstacle: '#e0632f',
      particle: '#ffe066',
      speedMultiplier: 1.0,
      gravityMultiplier: 1.0,
      skylineStyle: 'city-day',
      celestial: 'sun',
      ambient: 'birds',
      obstacleTheme: 'city',
    },
    {
      id: 'forest-mode',
      name: 'Forest Mode',
      tagline: "Nature's traps await.",
      icon: '🌲',
      unlockLevel: 1,
      distanceToNext: 750,
      sky: ['#0e3d34', '#1c6e5c', '#5fbf9e'],
      ground: '#22331a',
      groundLine: '#a6e39a',
      accent: '#c8ff9e',
      obstacle: '#7a4a2a',
      particle: '#c8ff9e',
      speedMultiplier: 1.08,
      gravityMultiplier: 1.0,
      skylineStyle: 'forest',
      celestial: 'sun',
      ambient: 'leaves',
      obstacleTheme: 'forest',
    },
    {
      id: 'night-mode',
      name: 'Night Mode',
      tagline: 'Darkness is your challenge.',
      icon: '🌙',
      unlockLevel: 3,
      distanceToNext: 800,
      sky: ['#1c1252', '#3a2170', '#7a4bc4'],
      ground: '#241a4d',
      groundLine: '#9fe8ff',
      accent: '#9fe8ff',
      obstacle: '#ff5da2',
      particle: '#9fe8ff',
      speedMultiplier: 1.05,
      gravityMultiplier: 1.0,
      skylineStyle: 'city-night',
      celestial: 'moon',
      ambient: 'fireflies',
      obstacleTheme: 'city',
    },
    {
      id: 'volcano-mode',
      name: 'Volcano Mode',
      tagline: 'Lava rises. Stay sharp.',
      icon: '🌋',
      unlockLevel: 5,
      distanceToNext: 850,
      sky: ['#3a0d05', '#7a1f0a', '#ff6a1a'],
      ground: '#2a0e08',
      groundLine: '#ff7a1a',
      accent: '#ffb703',
      obstacle: '#5c2a1a',
      particle: '#ff6a1a',
      speedMultiplier: 1.3,
      gravityMultiplier: 1.0,
      skylineStyle: 'volcano',
      celestial: 'none',
      ambient: 'embers',
      obstacleTheme: 'volcano',
    },
    {
      id: 'space-mode',
      name: 'Space Mode',
      tagline: 'Low gravity. High speed.',
      icon: '🪐',
      unlockLevel: 8,
      distanceToNext: 900,
      sky: ['#1c0f38', '#3a1060', '#8a1fd0'],
      ground: '#241533',
      groundLine: '#c400ff',
      accent: '#ff00d4',
      obstacle: '#9b00ff',
      particle: '#ff00d4',
      speedMultiplier: 1.22,
      gravityMultiplier: 0.8,
      skylineStyle: 'space',
      celestial: 'none',
      ambient: 'stardust',
      obstacleTheme: 'space',
    },
    {
      id: 'snow-mode',
      name: 'Snow Mode',
      tagline: 'Slippery slopes. Cold rush.',
      icon: '❄️',
      unlockLevel: 12,
      distanceToNext: 950,
      sky: ['#12203a', '#294a72', '#bcd9ee'],
      ground: '#dfeeff',
      groundLine: '#ffffff',
      accent: '#8fe9ff',
      obstacle: '#4fa8c9',
      particle: '#ffffff',
      speedMultiplier: 1.15,
      gravityMultiplier: 1.05,
      skylineStyle: 'snow',
      celestial: 'moon',
      ambient: 'snow',
      obstacleTheme: 'snow',
    },
  ];

  return WORLDS;
});
