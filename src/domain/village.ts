/**
 * The block village. Each structure is tied to ONE quest and grows only from the building blocks that quest has
 * earned: a level every `blocksPerLevel` blocks, up to `maxLevel` (docs/DECISIONS.md, "Village tied to quests").
 *
 * The village is a pure function of the blocks each quest has earned, which are cumulative ledger totals that only
 * ever grow. A level can never go backwards, nothing decays, and the same blocks always give the same village.
 * Structures, levels and story lines come from content (a content pack); the ones in this repo are original
 * starter or demo text.
 */

export interface VillageStructureDef {
  id: string;
  /** The one quest whose blocks build this structure. */
  questId: string;
  name: string;
  summary: string;
  blocksPerLevel: number;
  maxLevel: number;
  /** One calm line per level: index 0 is shown before anything is built, index `maxLevel` when it is finished. */
  stories: readonly string[];
  /** True for placeholder content. Must be labelled "demo" wherever it is shown. */
  isDemo: boolean;
}

export type StructureStatus = 'notStarted' | 'building' | 'complete';

export interface StructureState {
  structure: VillageStructureDef;
  /** Blocks this structure's quest has earned in total. */
  blocksEarned: number;
  /** Blocks placed: earned, up to what the structure can use. */
  blocksPlaced: number;
  blocksNeeded: number;
  /** Earned beyond what the structure can use yet; kept, never lost. */
  blocksSaved: number;
  level: number;
  /** Blocks placed toward the next level (0 when complete). */
  blocksIntoLevel: number;
  /** Blocks still needed for the next level (0 when complete). */
  blocksToNext: number;
  status: StructureStatus;
  /** The story line for the current level. */
  story: string;
}

export interface NextGoal {
  structureName: string;
  /** The level that the next blocks lead to. */
  toLevel: number;
  blocksToGo: number;
}

export interface VillageState {
  structures: StructureState[];
  blocksPlaced: number;
  blocksNeeded: number;
  /** Blocks earned that no structure can use: kept, never lost. Includes blocks from quests with no structure. */
  blocksSaved: number;
  /** Levels reached across all structures. */
  levelsReached: number;
  complete: boolean;
  next: NextGoal | null;
}

function wholeBlocks(blocks: number | undefined): number {
  return blocks !== undefined && Number.isFinite(blocks) && blocks > 0 ? Math.floor(blocks) : 0;
}

/**
 * One structure for a number of blocks its quest has earned.
 * Structures with a short or missing story list fall back to an empty line rather than failing.
 */
export function buildStructure(structure: VillageStructureDef, blocksEarned: number): StructureState {
  const earned = wholeBlocks(blocksEarned);
  const needed = structure.blocksPerLevel * structure.maxLevel;
  const placed = Math.min(earned, needed);
  const level = Math.min(structure.maxLevel, Math.floor(placed / structure.blocksPerLevel));
  const complete = level === structure.maxLevel;
  const into = complete ? 0 : placed - level * structure.blocksPerLevel;

  return {
    structure,
    blocksEarned: earned,
    blocksPlaced: placed,
    blocksNeeded: needed,
    blocksSaved: earned - placed,
    level,
    blocksIntoLevel: into,
    blocksToNext: complete ? 0 : structure.blocksPerLevel - into,
    status: placed === 0 ? 'notStarted' : complete ? 'complete' : 'building',
    story: structure.stories[level] ?? '',
  };
}

/**
 * The village. `blocksByQuest` is the blocks each quest has earned; `blocksEarnedTotal` is every block ever earned,
 * so blocks that no structure can use (a quest with no structure, or a finished structure) show as saved.
 */
export function buildVillage(
  definitions: readonly VillageStructureDef[],
  blocksByQuest: Readonly<Record<string, number>>,
  blocksEarnedTotal: number = Object.values(blocksByQuest).reduce((sum, n) => sum + wholeBlocks(n), 0),
): VillageState {
  const structures = definitions.map((def) => buildStructure(def, blocksByQuest[def.questId] ?? 0));
  const placed = structures.reduce((sum, s) => sum + s.blocksPlaced, 0);

  // The next goal is the structure closest to its next level; ties go to the earlier structure.
  let next: NextGoal | null = null;
  let best = Infinity;
  for (const s of structures) {
    if (s.status !== 'complete' && s.blocksToNext < best) {
      best = s.blocksToNext;
      next = { structureName: s.structure.name, toLevel: s.level + 1, blocksToGo: s.blocksToNext };
    }
  }

  return {
    structures,
    blocksPlaced: placed,
    blocksNeeded: structures.reduce((sum, s) => sum + s.blocksNeeded, 0),
    blocksSaved: Math.max(0, wholeBlocks(blocksEarnedTotal) - placed),
    levelsReached: structures.reduce((sum, s) => sum + s.level, 0),
    complete: structures.length > 0 && next === null,
    next,
  };
}

export interface GrownLevel {
  structureId: string;
  structureName: string;
  level: number;
  story: string;
}

/**
 * The levels reached since each structure was last viewed, in structure order then level order.
 * `seenLevels` is the highest level seen per structure id; a missing entry means 0.
 */
export function levelsGrownSince(seenLevels: Readonly<Record<string, number>>, village: VillageState): GrownLevel[] {
  const grown: GrownLevel[] = [];
  for (const s of village.structures) {
    const raw = seenLevels[s.structure.id] ?? 0;
    const seen = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    for (let level = seen + 1; level <= s.level; level++) {
      grown.push({ structureId: s.structure.id, structureName: s.structure.name, level, story: s.structure.stories[level] ?? '' });
    }
  }
  return grown;
}

export function describeStructureStatus(status: StructureStatus): string {
  switch (status) {
    case 'notStarted':
      return 'Not started';
    case 'building':
      return 'Building';
    case 'complete':
      return 'Complete';
  }
}

/** Plain words for a structure's level, so it is never shown by color alone. */
export function describeLevel(structure: StructureState): string {
  return `Level ${structure.level} of ${structure.structure.maxLevel}`;
}

/** Plain words for the blocks toward the next level, or a calm note when the structure is finished. */
export function describeProgress(structure: StructureState): string {
  if (structure.status === 'complete') return 'Finished for now.';
  const to = structure.blocksToNext;
  return `${structure.blocksIntoLevel} of ${structure.structure.blocksPerLevel} blocks toward Level ${structure.level + 1}. ${to} more ${to === 1 ? 'block' : 'blocks'} to go.`;
}

/** Plain words for what comes next, or a calm note if every structure is finished for now. */
export function describeNextGoal(state: VillageState): string {
  if (state.structures.length === 0) return 'There is nothing to build yet.';
  if (!state.next) {
    return state.blocksSaved > 0
      ? `The village is complete for now. ${state.blocksSaved} ${state.blocksSaved === 1 ? 'block is' : 'blocks are'} saved for what comes next.`
      : 'The village is complete for now.';
  }
  const { structureName, toLevel, blocksToGo } = state.next;
  return `Next: ${structureName} · Level ${toLevel}, ${blocksToGo} more ${blocksToGo === 1 ? 'block' : 'blocks'}.`;
}
