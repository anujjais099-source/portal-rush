/**
 * PORTAL RUSH art style: everything is drawn procedurally with Canvas 2D
 * primitives (no image/sprite-sheet files to download), which keeps the
 * game truly "playable immediately after installation" and gives it a
 * clean, flat-vector indie look. This module holds every draw routine and
 * the particle system used for coin sparkle, death bursts, portal swirls,
 * and powerup auras.
 */

/** Draws a runner as a simple geometric figure with a procedural run/jump/slide/fly cycle. */
export function drawRunner(ctx, opts) {
  const {
    x, y, // feet position (ground contact point)
    width = 40,
    height = 60,
    color = '#4fa3ff',
    accent = '#bfe1ff',
    state = 'run', // run | jump | slide | fly | celebrate | dead
    t = 0, // animation clock in seconds
    invulnerable = false,
    dashing = false,
    glow = null, // optional outline color (e.g. invincible aura)
    look = null, // { accessory, trim, skin }
  } = opts;

  ctx.save();
  ctx.translate(x, y);

  if (dashing) drawDashTrail(ctx, width, height, color);

  const bob = state === 'run' ? Math.sin(t * 14) * 3 : state === 'celebrate' ? Math.abs(Math.sin(t * 9)) * 7 : 0;
  const bodyH = state === 'slide' ? height * 0.55 : height;
  const bodyTop = state === 'fly' ? -height * 0.9 : -bodyH + bob;

  if (invulnerable && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.45;

  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 22;
  }

  // Legs
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  if (state === 'run') {
    const swing = Math.sin(t * 16);
    ctx.beginPath();
    ctx.moveTo(-6, bodyTop + bodyH);
    ctx.lineTo(-6 + swing * 14, 2);
    ctx.moveTo(6, bodyTop + bodyH);
    ctx.lineTo(6 - swing * 14, 2);
    ctx.stroke();
  } else if (state === 'jump') {
    ctx.beginPath();
    ctx.moveTo(-6, bodyTop + bodyH);
    ctx.lineTo(-14, bodyTop + bodyH + 16);
    ctx.moveTo(6, bodyTop + bodyH);
    ctx.lineTo(16, bodyTop + bodyH - 6);
    ctx.stroke();
  } else if (state === 'fly') {
    const flicker = 0.6 + Math.abs(Math.sin(t * 30)) * 0.4;
    ctx.beginPath();
    ctx.moveTo(-6, bodyTop + bodyH);
    ctx.lineTo(-9, bodyTop + bodyH + 10);
    ctx.moveTo(6, bodyTop + bodyH);
    ctx.lineTo(9, bodyTop + bodyH + 10);
    ctx.stroke();
    // Thruster flame beneath each foot.
    ctx.fillStyle = `rgba(255,170,60,${flicker})`;
    ctx.beginPath();
    ctx.moveTo(-9, bodyTop + bodyH + 10);
    ctx.lineTo(-2, bodyTop + bodyH + 10);
    ctx.lineTo(-6, bodyTop + bodyH + 10 + 14 * flicker);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, bodyTop + bodyH + 10);
    ctx.lineTo(2, bodyTop + bodyH + 10);
    ctx.lineTo(6, bodyTop + bodyH + 10 + 14 * flicker);
    ctx.fill();
  } else if (state === 'celebrate') {
    const hop = Math.abs(Math.sin(t * 9)) * 6;
    ctx.beginPath();
    ctx.moveTo(-6, bodyTop + bodyH);
    ctx.lineTo(-9, bodyTop + bodyH + 10 - hop * 0.4);
    ctx.moveTo(6, bodyTop + bodyH);
    ctx.lineTo(9, bodyTop + bodyH + 10 - hop * 0.4);
    ctx.stroke();
  } else if (state === 'slide') {
    ctx.beginPath();
    ctx.moveTo(-width * 0.5, 0);
    ctx.lineTo(width * 0.5, 0);
    ctx.stroke();
  } else if (state === 'dead') {
    ctx.beginPath();
    ctx.moveTo(-10, bodyTop + bodyH);
    ctx.lineTo(-16, 4);
    ctx.moveTo(10, bodyTop + bodyH);
    ctx.lineTo(16, 4);
    ctx.stroke();
  }

  // Body
  ctx.fillStyle = color;
  const bw = state === 'slide' ? width * 1.1 : width * 0.62;
  roundRect(ctx, -bw / 2, bodyTop, bw, bodyH * 0.72, 10);
  ctx.fill();

  // Accent stripe
  ctx.fillStyle = accent;
  roundRect(ctx, -bw / 2 + 4, bodyTop + bodyH * 0.18, bw - 8, bodyH * 0.14, 5);
  ctx.fill();

  // Head
  const headR = width * 0.28;
  const headY = bodyTop - headR * (state === 'slide' ? 0.2 : 0.9);
  const skin = (look && look.skin) || color;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(state === 'dead' ? 6 : 4, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b0730';
  ctx.beginPath();
  ctx.arc(4 + headR * 0.45, headY - 2, headR * 0.16, 0, Math.PI * 2);
  ctx.fill();

  if (look) drawAccessory(ctx, look, headY, headR, bodyTop, bw);

  // Arms
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  if (state === 'run') {
    const swing = Math.sin(t * 16 + Math.PI);
    ctx.beginPath();
    ctx.moveTo(-4, bodyTop + 8);
    ctx.lineTo(-4 + swing * 12, bodyTop + 26);
    ctx.stroke();
  } else if (state === 'jump') {
    ctx.beginPath();
    ctx.moveTo(-4, bodyTop + 8);
    ctx.lineTo(-16, bodyTop - 6);
    ctx.stroke();
  } else if (state === 'fly') {
    ctx.beginPath();
    ctx.moveTo(-4, bodyTop + 8);
    ctx.lineTo(-18, bodyTop + 4);
    ctx.moveTo(4, bodyTop + 8);
    ctx.lineTo(18, bodyTop + 4);
    ctx.stroke();
  } else if (state === 'celebrate') {
    const wave = Math.sin(t * 10) * 6;
    ctx.beginPath();
    ctx.moveTo(-4, bodyTop + 8);
    ctx.lineTo(-16 + wave, bodyTop - 14);
    ctx.moveTo(4, bodyTop + 8);
    ctx.lineTo(16 - wave, bodyTop - 14);
    ctx.stroke();
  }

  if (glow) ctx.restore();
  ctx.restore();
}

/** Small per-character accessory drawn on the head/body so silhouettes read as distinct "costumes". */
function drawAccessory(ctx, look, headY, headR, bodyTop, bw) {
  const { accessory, trim } = look;
  ctx.fillStyle = trim || '#ffffff';
  ctx.strokeStyle = trim || '#ffffff';
  switch (accessory) {
    case 'cap':
      roundRect(ctx, 4 - headR, headY - headR - 2, headR * 2.1, headR * 0.8, 3);
      ctx.fill();
      roundRect(ctx, 4 - headR * 0.3, headY - headR * 0.3, headR * 1.5, headR * 0.35, 2);
      ctx.fill();
      break;
    case 'bandage':
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(4, headY, headR * 0.92, -0.4, 2.6);
      ctx.stroke();
      break;
    case 'headband':
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(4 - headR, headY - headR * 0.35);
      ctx.lineTo(4 + headR, headY - headR * 0.35);
      ctx.stroke();
      break;
    case 'mask':
      roundRect(ctx, 4 - headR, headY - headR * 0.25, headR * 2, headR * 0.5, 2);
      ctx.fill();
      break;
    case 'strawhat':
      ctx.beginPath();
      ctx.ellipse(4, headY - headR * 1.1, headR * 1.9, headR * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4 - headR * 0.7, headY - headR * 1.1);
      ctx.lineTo(4 + headR * 0.7, headY - headR * 1.1);
      ctx.lineTo(4 + headR * 0.4, headY - headR * 2.1);
      ctx.lineTo(4 - headR * 0.4, headY - headR * 2.1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hardhat':
      ctx.beginPath();
      ctx.arc(4, headY - headR * 0.2, headR * 1.05, Math.PI, 0);
      ctx.fill();
      roundRect(ctx, 4 - headR * 1.1, headY - headR * 0.25, headR * 2.2, headR * 0.25, 2);
      ctx.fill();
      break;
    case 'stethoscope':
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(4, bodyTop + 20, headR * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(4 - headR * 0.3, bodyTop + 20);
      ctx.quadraticCurveTo(4 - headR, bodyTop, 4 - headR * 0.2, headY);
      ctx.stroke();
      break;
    case 'firehelmet':
      ctx.beginPath();
      ctx.arc(4, headY - headR * 0.15, headR * 1.1, Math.PI, 0);
      ctx.fill();
      roundRect(ctx, 4 - headR * 1.2, headY - headR * 0.2, headR * 2.4, headR * 0.3, 3);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(4, headY - headR * 0.7, headR * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'goggles':
      ctx.fillStyle = 'rgba(180,230,255,0.55)';
      roundRect(ctx, 4 - headR * 0.95, headY - headR * 0.25, headR * 1.9, headR * 0.55, 4);
      ctx.fill();
      ctx.strokeStyle = trim || '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    case 'glasses':
      ctx.strokeStyle = '#2b2b3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(4 - headR * 0.4, headY, headR * 0.32, 0, Math.PI * 2);
      ctx.arc(4 + headR * 0.4, headY, headR * 0.32, 0, Math.PI * 2);
      ctx.moveTo(4 - headR * 0.08, headY);
      ctx.lineTo(4 + headR * 0.08, headY);
      ctx.stroke();
      break;
    case 'militaryhelmet':
      ctx.beginPath();
      ctx.arc(4, headY - headR * 0.15, headR * 1.15, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      roundRect(ctx, 4 - headR * 1.15, headY - headR * 0.25, headR * 2.3, headR * 0.25, 2);
      ctx.fill();
      break;
    case 'ninjahood':
      roundRect(ctx, 4 - headR * 1.05, headY - headR * 1.2, headR * 2.1, headR * 1.5, headR * 0.6);
      ctx.fill();
      ctx.fillStyle = '#0b0730';
      roundRect(ctx, 4 - headR * 0.9, headY - headR * 0.2, headR * 1.8, headR * 0.4, 2);
      ctx.fill();
      break;
    case 'spacehelmet':
      ctx.fillStyle = 'rgba(190,230,255,0.5)';
      ctx.beginPath();
      ctx.arc(4, headY, headR * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = trim || '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    case 'ponytail':
      ctx.beginPath();
      ctx.moveTo(4 + headR * 0.85, headY - headR * 0.3);
      ctx.quadraticCurveTo(4 + headR * 1.9, headY, 4 + headR * 1.3, headY + headR * 1.4);
      ctx.quadraticCurveTo(4 + headR * 1.0, headY + headR * 0.6, 4 + headR * 0.6, headY);
      ctx.closePath();
      ctx.fill();
      break;
    case 'backpack':
      ctx.fillStyle = trim || '#ffffff';
      roundRect(ctx, -bw * 0.75, bodyTop + bw * 0.15, bw * 0.4, bw * 0.9, 5);
      ctx.fill();
      break;
    default:
      break;
  }
}

function drawDashTrail(ctx, width, height, color) {
  ctx.save();
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.22 / i;
    ctx.fillStyle = color;
    roundRect(ctx, -width * 0.35 - i * 16, -height * 0.8, width * 0.7, height * 0.72, 10);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * Draws an obstacle skinned per-world (`theme`: city/forest/space/volcano/snow) so the
 * same underlying jump/slide hazard reads as a car, a fallen log, a laser gate, a lava
 * geyser, or an ice block depending on which world the run is currently in.
 */
export function drawObstacle(ctx, ob, groundY, color, theme = 'city', t = 0) {
  const sx = ob.screenX;
  const overhead = ob.kind === 'overhead';
  const top = overhead ? groundY - ob.h - ob.gap : groundY - ob.h;
  const w = ob.w, h = ob.h;

  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

  if (theme === 'space' && overhead) {
    // Laser gate: a thin pulsing beam instead of a solid bar.
    const pulse = 0.6 + Math.abs(Math.sin(t * 10)) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillRect(sx - w / 2, top + h * 0.4, w, h * 0.2);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx - w / 2, top + h * 0.5, 5, 0, Math.PI * 2);
    ctx.arc(sx + w / 2, top + h * 0.5, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme === 'space') {
    // Alien crystal pod.
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx + w / 2, top + h * 0.4);
    ctx.lineTo(sx + w * 0.32, top + h);
    ctx.lineTo(sx - w * 0.32, top + h);
    ctx.lineTo(sx - w / 2, top + h * 0.4);
    ctx.closePath();
    ctx.fill();
  } else if (theme === 'volcano' && overhead) {
    // Hanging ember cluster.
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(sx + i * w * 0.3, top + h * 0.6, h * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'volcano') {
    // Lava rock with a flickering flame on top.
    roundRect(ctx, sx - w / 2, top + h * 0.2, w, h * 0.8, 6);
    ctx.fill();
    const flicker = 0.7 + Math.abs(Math.sin(t * 14)) * 0.3;
    ctx.fillStyle = `rgba(255,180,40,${flicker})`;
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.22, top + h * 0.2);
    ctx.quadraticCurveTo(sx, top - h * 0.25 * flicker, sx + w * 0.22, top + h * 0.2);
    ctx.fill();
  } else if (theme === 'snow' && overhead) {
    // Hanging icicle.
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, top);
    ctx.lineTo(sx + w / 2, top);
    ctx.lineTo(sx, top + h);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (theme === 'snow') {
    // Translucent ice block.
    ctx.globalAlpha = 0.8;
    roundRect(ctx, sx - w / 2, top, w, h, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - w / 2 + 3, top + 3, w - 6, h - 6);
  } else if (theme === 'forest' && overhead) {
    // Low branch.
    roundRect(ctx, sx - w / 2, top, w, h, 8);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(sx - w / 2 + 6 + i * (w / 3), top + h, 3, 8);
    }
  } else if (theme === 'forest') {
    // Fallen log with wood-grain rings.
    roundRect(ctx, sx - w / 2, top, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx + w / 2 - 6, top + h / 2, h * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  } else if (overhead) {
    // City: hanging traffic barrier arm.
    roundRect(ctx, sx - w / 2, top, w, h, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) ctx.fillRect(sx - w / 2 + 6 + i * (w / 3), top + h * 0.3, w / 6, h * 0.4);
  } else {
    // City: a simple car silhouette.
    roundRect(ctx, sx - w / 2, top + h * 0.25, w, h * 0.55, 6);
    ctx.fill();
    roundRect(ctx, sx - w * 0.28, top, w * 0.56, h * 0.4, 4);
    ctx.fill();
    ctx.fillStyle = '#1a1a24';
    ctx.beginPath();
    ctx.arc(sx - w * 0.28, top + h, h * 0.16, 0, Math.PI * 2);
    ctx.arc(sx + w * 0.28, top + h, h * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawCoin(ctx, x, y, r, t) {
  const squash = Math.abs(Math.cos(t * 6 + x * 0.01));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.25, squash), 1);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, '#fff6c8');
  grad.addColorStop(1, '#ffcc33');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a6710a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawGem(ctx, x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2) * 0.15);
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, '#c6f9ff');
  grad.addColorStop(1, '#2fbfe0');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.85, -r * 0.15);
  ctx.lineTo(r * 0.55, r);
  ctx.lineTo(-r * 0.55, r);
  ctx.lineTo(-r * 0.85, -r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0b6f8a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

export function drawKey(ctx, x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 4) * 0.2);
  ctx.strokeStyle = '#ffd83d';
  ctx.fillStyle = '#ffd83d';
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-r * 0.4, 0, r * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r * 0.9, 0);
  ctx.stroke();
  ctx.fillRect(r * 0.55, 0, r * 0.12, r * 0.35);
  ctx.fillRect(r * 0.78, 0, r * 0.12, r * 0.3);
  ctx.restore();
}

export function drawMysteryBox(ctx, x, y, r, t) {
  ctx.save();
  ctx.translate(x, y - Math.abs(Math.sin(t * 4)) * 3);
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#c86bff');
  grad.addColorStop(1, '#7a1fd0');
  ctx.fillStyle = grad;
  roundRect(ctx, -r, -r, r * 2, r * 2, 4);
  ctx.fill();
  ctx.strokeStyle = '#ffd83d';
  ctx.lineWidth = 2;
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = '#ffd83d';
  ctx.font = `bold ${r}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 1);
  ctx.restore();
}

const POWERUP_GLYPHS = {
  magnet: '#ff5da2',
  shield: '#4fd1ff',
  doubleCoin: '#ffd83d',
  speed: '#3dffb0',
  jetpack: '#ff8a3d',
  invincible: '#b46bff',
  slowMotion: '#5da9ff',
};

const POWERUP_LETTERS = {
  magnet: 'M', shield: 'S', doubleCoin: 'x2', speed: '>>', jetpack: 'J', invincible: '★', slowMotion: '◷',
};

export function drawPowerupIcon(ctx, kind, x, y, r, t) {
  const color = POWERUP_GLYPHS[kind] || '#ffffff';
  const pulse = 1 + Math.sin(t * 6) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b0730';
  const glyph = POWERUP_LETTERS[kind] || '?';
  ctx.font = `bold ${glyph.length > 1 ? r * 0.85 : r}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 0, 1);
  ctx.restore();
}

export function drawPortal(ctx, x, y, radius, t, color) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    const rr = radius * (0.55 + i * 0.22) * (1 + Math.sin(t * 3 + i) * 0.03);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85 - i * 0.22;
    ctx.lineWidth = 6 - i * 1.4;
    ctx.ellipse(0, 0, rr * 0.42, rr, t * 2 + i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSun(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#fff6d8';
  ctx.shadowColor = '#ffe066';
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawMoon(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#f2f4ff';
  ctx.shadowColor = '#9fe8ff';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(160,180,220,0.35)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.25, y + r * 0.35, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCloud(ctx, x, y, scale) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(x, y, 22 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 16 * scale, y - 5 * scale, 15 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 16 * scale, y + 2 * scale, 14 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawTree(ctx, x, groundY, h, canopyColor, trunkColor) {
  ctx.save();
  ctx.fillStyle = trunkColor;
  ctx.fillRect(x - 4, groundY - h * 0.35, 8, h * 0.35);
  ctx.fillStyle = canopyColor;
  ctx.beginPath();
  ctx.arc(x, groundY - h * 0.55, h * 0.32, 0, Math.PI * 2);
  ctx.arc(x - h * 0.2, groundY - h * 0.42, h * 0.24, 0, Math.PI * 2);
  ctx.arc(x + h * 0.2, groundY - h * 0.42, h * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlanet(ctx, x, y, r, color, ringed) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (ringed) {
    ctx.strokeStyle = `${color}aa`;
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.7, r * 0.5, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Looping ambient "sky life" layer picked per-world by `worlds/worldConfig.js`'s
 * `ambient` field: birds (day), fireflies (night), drifting leaves (forest),
 * rising embers (volcano), or falling snow (snow). Purely decorative — driven
 * off (distance, t) so it's smooth and deterministic, never Math.random() per frame.
 */
export function drawAmbientLayer(ctx, ambient, distance, t, width, skyBottom) {
  if (!ambient || ambient === 'none') return;
  ctx.save();

  if (ambient === 'birds') {
    const offset = (distance * 0.1) % (width + 200);
    ctx.strokeStyle = 'rgba(40,40,60,0.55)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const bx = ((i * 260 - offset + width + 200) % (width + 200)) - 100;
      const by = 50 + i * 22 + Math.sin(t * 3 + i) * 6;
      const flap = Math.sin(t * 10 + i * 2) * 6;
      ctx.beginPath();
      ctx.moveTo(bx - 8, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 8, by - flap);
      ctx.stroke();
    }
  } else if (ambient === 'fireflies') {
    for (let i = 0; i < 10; i++) {
      const fx = ((i * 97 + distance * 0.2) % (width + 60)) - 30;
      const fy = skyBottom * 0.55 + ((i * 53) % (skyBottom * 0.4)) + Math.sin(t * 2 + i) * 10;
      const glow = 0.3 + 0.6 * Math.abs(Math.sin(t * 3 + i * 1.7));
      ctx.fillStyle = `rgba(210,255,150,${glow})`;
      ctx.shadowColor = '#d2ff96';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ambient === 'leaves') {
    ctx.fillStyle = '#bfe89e';
    for (let i = 0; i < 12; i++) {
      const lx = ((i * 83 + distance * 0.3 + t * 20) % (width + 40)) - 20;
      const ly = ((i * 61 + t * 30) % skyBottom);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(t * 2 + i);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (ambient === 'embers') {
    for (let i = 0; i < 14; i++) {
      const ex = ((i * 71 + distance * 0.25) % (width + 40)) - 20;
      const cycle = (t * 40 + i * 37) % skyBottom;
      const ey = skyBottom - cycle;
      const glow = 1 - cycle / skyBottom;
      ctx.fillStyle = `rgba(255,150,40,${Math.max(0, glow)})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ambient === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 26; i++) {
      const sxp = ((i * 53 + Math.sin(t + i) * 20 + distance * 0.15) % (width + 20)) - 10;
      const syp = ((i * 41 + t * 45) % skyBottom);
      ctx.beginPath();
      ctx.arc(sxp, syp, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  burst(x, y, color, count = 14, opts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (opts.speed || 220) * (0.4 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (opts.upBias || 0),
        life: 0,
        maxLife: (opts.life || 0.6) * (0.7 + Math.random() * 0.6),
        size: (opts.size || 4) * (0.6 + Math.random() * 0.8),
        color,
      });
    }
  }

  update(dt) {
    const gravity = 500;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += gravity * dt * 0.4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.particles.length = 0;
  }
}
