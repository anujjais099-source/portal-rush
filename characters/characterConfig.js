/**
 * PORTAL RUSH - character roster.
 *
 * UMD-style module: usable via `require()` on the server (Node/CommonJS)
 * and via a plain <script> tag on the client, where it attaches itself to
 * `window.PR_CHARACTERS` for the browser game engine and UI to read.
 *
 * Stats are multipliers applied on top of the base player physics in
 * game/player.js: jump, speed, slideDuration, magnetRadius, dashCooldown
 * (lower = recharges faster), maxJumpsBonus (extra mid-air jumps beyond the
 * default double jump). `startShield` grants one free hit-absorb per run.
 *
 * `look` drives the procedural illustration in assets/sprites.js: since
 * there are no bitmap art assets, each character is a distinct silhouette
 * (outfit color + accessory) drawn with Canvas 2D primitives rather than
 * hand-painted art.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PR_CHARACTERS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const CHARACTERS = [
    {
      id: 'doctor',
      name: 'Doctor',
      tagline: 'Steady hands, steady pace. The starter runner.',
      cost: 0,
      color: '#eef3f8',
      accent: '#3fa9e0',
      stats: { jump: 1.0, speed: 1.0, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#eef3f8', trim: '#3fa9e0', accessory: 'stethoscope', skin: '#f1c6a0' },
    },
    {
      id: 'patient',
      name: 'Patient',
      tagline: 'Light on his feet, big on hops.',
      cost: 400,
      color: '#bfe3ff',
      accent: '#ffffff',
      stats: { jump: 1.12, speed: 0.92, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#bfe3ff', trim: '#ffffff', accessory: 'bandage', skin: '#f1c6a0' },
    },
    {
      id: 'police',
      name: 'Police',
      tagline: 'Backup included: starts every run with a shield.',
      cost: 1000,
      color: '#22335c',
      accent: '#ffd83d',
      stats: { jump: 0.95, speed: 0.98, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: true,
      look: { outfit: '#22335c', trim: '#ffd83d', accessory: 'cap', skin: '#e2a878' },
    },
    {
      id: 'normal-man',
      name: 'Normal Man',
      tagline: 'No gimmicks. Just a solid, cheap all-rounder.',
      cost: 200,
      color: '#e04b4b',
      accent: '#3457c9',
      stats: { jump: 1.0, speed: 1.0, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#e04b4b', trim: '#3457c9', accessory: 'none', skin: '#f1c6a0' },
    },
    {
      id: 'athlete',
      name: 'Athlete',
      tagline: 'Built for speed, shorter slides.',
      cost: 1400,
      color: '#2fbf71',
      accent: '#ffffff',
      stats: { jump: 1.0, speed: 1.22, slideDuration: 0.82, magnetRadius: 1.0, dashCooldown: 0.9 },
      startShield: false,
      look: { outfit: '#2fbf71', trim: '#ffffff', accessory: 'headband', skin: '#8a5a3b' },
    },
    {
      id: 'thief',
      name: 'Thief',
      tagline: 'Coins practically jump into his pockets.',
      cost: 1100,
      color: '#2b2b3a',
      accent: '#b46bff',
      stats: { jump: 1.0, speed: 1.05, slideDuration: 1.0, magnetRadius: 1.6, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#2b2b3a', trim: '#b46bff', accessory: 'mask', skin: '#e2a878' },
    },
    {
      id: 'farmer',
      name: 'Farmer',
      tagline: 'Used to jumping fences. Big hops.',
      cost: 700,
      color: '#7a5230',
      accent: '#ffd83d',
      stats: { jump: 1.2, speed: 0.96, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#7a5230', trim: '#ffd83d', accessory: 'strawhat', skin: '#e2a878' },
    },
    {
      id: 'engineer',
      name: 'Engineer',
      tagline: 'Rigged himself for a triple jump and a fast dash recharge.',
      cost: 1800,
      color: '#ff8a3d',
      accent: '#2b2b3a',
      stats: { jump: 0.95, speed: 0.98, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 0.55, maxJumpsBonus: 1 },
      startShield: false,
      look: { outfit: '#ff8a3d', trim: '#2b2b3a', accessory: 'hardhat', skin: '#f1c6a0' },
    },
    {
      id: 'firefighter',
      name: 'Firefighter',
      tagline: 'Trained to duck under smoke — extra-long slides.',
      cost: 1200,
      color: '#d1362f',
      accent: '#ffd83d',
      stats: { jump: 1.05, speed: 0.95, slideDuration: 1.2, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#d1362f', trim: '#ffd83d', accessory: 'firehelmet', skin: '#e2a878' },
    },
    {
      id: 'scientist',
      name: 'Scientist',
      tagline: 'Calculates the optimal path to every coin.',
      cost: 1300,
      color: '#eef3f8',
      accent: '#3fa9e0',
      stats: { jump: 1.0, speed: 0.98, slideDuration: 1.0, magnetRadius: 1.3, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#eef3f8', trim: '#3fa9e0', accessory: 'goggles', skin: '#f1c6a0' },
    },
    {
      id: 'teacher',
      name: 'Teacher',
      tagline: 'Disciplined and dependable. A cheap, solid pick.',
      cost: 900,
      color: '#8a5a3b',
      accent: '#e04b4b',
      stats: { jump: 1.0, speed: 1.0, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 0.95 },
      startShield: false,
      look: { outfit: '#8a5a3b', trim: '#e04b4b', accessory: 'glasses', skin: '#e2a878' },
    },
    {
      id: 'soldier',
      name: 'Soldier',
      tagline: 'Body armor absorbs the first hit of every run.',
      cost: 1600,
      color: '#4a5a2f',
      accent: '#c8ff9e',
      stats: { jump: 0.9, speed: 1.05, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: true,
      look: { outfit: '#4a5a2f', trim: '#c8ff9e', accessory: 'militaryhelmet', skin: '#8a5a3b' },
    },
    {
      id: 'ninja',
      name: 'Ninja',
      tagline: 'Blazing fast with a nearly instant dash recharge.',
      cost: 2000,
      color: '#1a1a24',
      accent: '#ff2f4a',
      stats: { jump: 1.1, speed: 1.15, slideDuration: 0.75, magnetRadius: 1.0, dashCooldown: 0.5 },
      startShield: false,
      look: { outfit: '#1a1a24', trim: '#ff2f4a', accessory: 'ninjahood', skin: '#e2a878' },
    },
    {
      id: 'astronaut',
      name: 'Astronaut',
      tagline: 'Trained for low gravity. The highest jump around.',
      cost: 2500,
      color: '#e8ecf2',
      accent: '#ff8a3d',
      stats: { jump: 1.3, speed: 0.92, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#e8ecf2', trim: '#ff8a3d', accessory: 'spacehelmet', skin: '#f1c6a0' },
    },
    {
      id: 'normal-woman',
      name: 'Normal Woman',
      tagline: 'No gimmicks here either. A second cheap all-rounder.',
      cost: 250,
      color: '#b34fa3',
      accent: '#ffd83d',
      stats: { jump: 1.0, speed: 1.0, slideDuration: 1.0, magnetRadius: 1.0, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#b34fa3', trim: '#ffd83d', accessory: 'ponytail', skin: '#e2a878' },
    },
    {
      id: 'student',
      name: 'Student',
      tagline: 'Energetic and quick to grab every coin in reach.',
      cost: 500,
      color: '#3457c9',
      accent: '#ffffff',
      stats: { jump: 1.05, speed: 1.0, slideDuration: 1.0, magnetRadius: 1.15, dashCooldown: 1.0 },
      startShield: false,
      look: { outfit: '#3457c9', trim: '#ffffff', accessory: 'backpack', skin: '#f1c6a0' },
    },
  ];

  return CHARACTERS;
});
