/**
 * Which stage of its picture a structure shows. Every structure picture has the same six stages (0 is the bare plot,
 * 5 is finished), but a structure can have any number of levels, so the level is spread across the six stages. A
 * structure with five levels shows one stage per level. The stage never goes down, because the level never does.
 */
export const VILLAGE_STAGE_COUNT = 6;

export function villageStage(level: number, maxLevel: number): number {
  if (!Number.isFinite(level) || !Number.isFinite(maxLevel) || maxLevel <= 0 || level <= 0) return 0;
  const last = VILLAGE_STAGE_COUNT - 1;
  return Math.min(last, Math.round((level / maxLevel) * last));
}
