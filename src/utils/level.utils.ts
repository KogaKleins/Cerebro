/**
 * Level utilities (shared between frontend/server)
 */
export const LEVEL_CONFIG = {
  baseXP: 100,
  exponent: 1.5,
  maxLevel: 100
};

export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(LEVEL_CONFIG.baseXP * Math.pow(level - 1, LEVEL_CONFIG.exponent));
}

export function getTotalXPForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXPForLevel(i);
  }
  return total;
}

export function calculateLevel(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;

  while (level < LEVEL_CONFIG.maxLevel) {
    const nextLevelXP = getXPForLevel(level + 1);
    if (totalXP < xpNeeded + nextLevelXP) {
      break;
    }
    xpNeeded += nextLevelXP;
    level++;
  }

  return level;
}

export function calculateCurrentLevelXP(totalXP: number, level: number): number {
  const xpForPreviousLevels = getTotalXPForLevel(level);
  return totalXP - xpForPreviousLevels;
}
