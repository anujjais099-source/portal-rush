/** Axis-aligned collision helpers, all working in "height above ground" space. */

/**
 * @param {{top:number,height:number,width:number}} playerHitbox player's vertical hitbox (screen space)
 * @param {number} playerHalfWidthWorld how much world-x tolerance the player occupies
 * @param {number} playerWorldX player's fixed world-x position
 * @param {object} obstacle {x, w, kind, h, gap}
 */
export function playerHitsObstacle(playerHitbox, playerWorldX, obstacle) {
  const halfW = obstacle.w / 2;
  const overlapX = Math.abs(obstacle.x - playerWorldX) < halfW + playerHitbox.width / 2 - 4;
  if (!overlapX) return false;

  const pBottom = playerHitbox.top;
  const pTop = playerHitbox.top + playerHitbox.height;

  if (obstacle.kind === 'overhead') {
    // Hazard occupies the band from `gap` up to `gap + h` above the ground.
    const obBottom = obstacle.gap;
    const obTop = obstacle.gap + obstacle.h;
    return pTop > obBottom && pBottom < obTop;
  }

  // Ground obstacle occupies from ground (0) up to h.
  const obBottom = 0;
  const obTop = obstacle.h;
  return pTop > obBottom && pBottom < obTop;
}

export function withinPickupRadius(itemWorldX, itemHeight, playerWorldX, playerHeight, radius) {
  const dx = itemWorldX - playerWorldX;
  const dy = itemHeight - playerHeight;
  return dx * dx + dy * dy <= radius * radius;
}
