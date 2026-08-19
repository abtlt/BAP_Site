// ===== Système de niveaux / XP =====
// Chaque article validé rapporte XP_PER_ARTICLE points d'expérience à
// chacun des journalistes ayant travaillé dessus (principal + secondaire).
//
// Progression : il faut 75 xp pour passer du niveau 0 au niveau 1, puis
// le seuil augmente de 35 % à chaque niveau (croissance exponentielle).
export const XP_PER_ARTICLE = 75;

const BASE_XP = 75;
const GROWTH_FACTOR = 1.35;

// xp nécessaire pour passer de `level` à `level + 1`.
export function xpRequiredForLevel(level: number): number {
  return Math.round(BASE_XP * Math.pow(GROWTH_FACTOR, level));
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  percent: number;
}

export function levelInfo(totalXp: number): LevelInfo {
  let level = 0;
  let remaining = Math.max(0, totalXp || 0);
  let xpForNext = xpRequiredForLevel(level);

  while (remaining >= xpForNext) {
    remaining -= xpForNext;
    level += 1;
    xpForNext = xpRequiredForLevel(level);
  }

  const percent = xpForNext > 0 ? Math.min(100, Math.round((remaining / xpForNext) * 100)) : 100;

  return { level, totalXp: totalXp || 0, xpIntoLevel: remaining, xpForNextLevel: xpForNext, percent };
}
