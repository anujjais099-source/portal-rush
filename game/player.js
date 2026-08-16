/**
 * Player physics/state machine. Positions are in "screen" pixels relative
 * to the ground line; world-space distance (how far the run has traveled)
 * is tracked separately by the engine.
 */

export const GRAVITY = 2600;
export const JUMP_VELOCITY = -900;
export const DOUBLE_JUMP_VELOCITY = -760; // subsequent air-jumps are slightly weaker
export const SLIDE_DURATION = 0.55; // seconds, before character.slideDuration multiplier
export const BASE_MAX_JUMPS = 2; // everyone gets a double jump by default

export const DASH_DISTANCE = 130; // world units instantly covered by a dash
export const DASH_INVULN_TIME = 0.45;
export const BASE_DASH_COOLDOWN = 3; // seconds, before character.stats.dashCooldown multiplier

export const JETPACK_HEIGHT = 150; // height above ground while flying
export const JETPACK_RISE_SPEED = 900;

export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 62;
export const SLIDE_HEIGHT = 30;

export class Player {
  constructor(character) {
    this.character = character;
    this.state = 'run'; // run | jump | slide | fly | dead
    this.y = 0; // height above ground (0 = grounded), positive = up
    this.vy = 0;
    this.slideTimer = 0;
    this.animClock = 0;
    this.shield = !!character.startShield;
    this.invulnerableTimer = 0;
    this.alive = true;

    this.maxJumps = BASE_MAX_JUMPS + (character.stats.maxJumpsBonus || 0);
    this.jumpsUsed = 0;

    this.dashCooldownRemaining = 0;
    this.dashTimer = 0;

    this.jetpackActive = false;
    this.invincible = false;
  }

  get hitbox() {
    if (this.state === 'slide') {
      return { top: this.y, height: SLIDE_HEIGHT, width: PLAYER_WIDTH * 1.05 };
    }
    return { top: this.y, height: PLAYER_HEIGHT, width: PLAYER_WIDTH };
  }

  get grounded() {
    return this.y <= 0.001 && this.state !== 'jump' && this.state !== 'fly';
  }

  get dashing() {
    return this.dashTimer > 0;
  }

  jump(audio) {
    if (!this.alive || this.jetpackActive) return;
    if (this.state === 'slide') return;
    if (this.state === 'run') {
      this.state = 'jump';
      this.vy = JUMP_VELOCITY * this.character.stats.jump;
      this.jumpsUsed = 1;
      if (audio) audio.jump();
      return;
    }
    if (this.state === 'jump' && this.jumpsUsed < this.maxJumps) {
      this.vy = DOUBLE_JUMP_VELOCITY * this.character.stats.jump;
      this.jumpsUsed += 1;
      if (audio) audio.doubleJump();
    }
  }

  slide(audio) {
    if (!this.alive) return;
    if (this.state === 'jump' || this.state === 'fly') return; // can't slide mid-air
    this.state = 'slide';
    this.slideTimer = SLIDE_DURATION * this.character.stats.slideDuration;
    if (audio) audio.slide();
  }

  dash(audio) {
    if (!this.alive || this.dashCooldownRemaining > 0) return false;
    this.dashTimer = DASH_INVULN_TIME;
    this.dashCooldownRemaining = BASE_DASH_COOLDOWN * (this.character.stats.dashCooldown || 1);
    if (audio) audio.dash();
    return true;
  }

  grantShield() {
    this.shield = true;
  }

  hit(audio) {
    if (this.dashing || this.invincible || this.jetpackActive) return false;
    if (this.shield) {
      this.shield = false;
      this.invulnerableTimer = 1.1;
      if (audio) audio.powerup();
      return false; // absorbed, not dead
    }
    this.alive = false;
    this.state = 'dead';
    if (audio) audio.hit();
    return true;
  }

  update(dt, gravityMultiplier = 1) {
    this.animClock += dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.dashCooldownRemaining > 0) this.dashCooldownRemaining -= dt;

    if (this.jetpackActive) {
      const target = JETPACK_HEIGHT;
      const diff = target - this.y;
      this.y += Math.sign(diff) * Math.min(Math.abs(diff), JETPACK_RISE_SPEED * dt);
      this.vy = 0;
      return;
    }

    if (this.state === 'jump') {
      // vy is negative while rising (up = +y), so height grows by -vy*dt.
      this.vy += GRAVITY * gravityMultiplier * dt;
      this.y += -this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.state = 'run';
        this.jumpsUsed = 0;
      }
    } else if (this.state === 'slide') {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.state = 'run';
    }
  }

  setJetpack(active) {
    if (active) {
      this.jetpackActive = true;
      if (this.state === 'jump') this.jumpsUsed = 0;
      this.state = 'fly';
      this.vy = 0;
    } else if (this.jetpackActive) {
      this.jetpackActive = false;
      this.state = this.y > 0 ? 'jump' : 'run';
    }
  }
}
