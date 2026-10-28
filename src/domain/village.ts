/**
 * The block village. EVERY structure, stage and story line here is a clearly labelled DEMO PLACEHOLDER: the
 * real four structures and their story stages are not defined (docs/DECISIONS.md, "Proposed village (M11)").
 *
 * The village is a pure function of one number: the building blocks earned so far, a cumulative total that
 * only ever grows. Blocks are placed in order, filling each stage of each structure. Because nothing else
 * feeds it, a stage can never go backwards, and the same blocks always give the same village.
 */

export interface VillageStageDef {
  id: string;
  title: string;
  /** One calm line shown once the stage is built. */
  story: string;
  /** Blocks this stage takes. */
  blocks: number;
}

export interface VillageStructureDef {
  id: string;
  name: string;
  summary: string;
  stages: readonly VillageStageDef[];
  /** True for placeholder content. Must be labelled "demo" wherever it is shown. */
  isDemo: boolean;
}

export const VILLAGE: readonly VillageStructureDef[] = [
  {
    id: 'demo-workshop',
    name: 'Workshop',
    summary: 'A place to sort tools and plan the day.',
    isDemo: true,
    stages: [
      { id: 'foundation', title: 'Foundation', story: 'A flat stone floor is laid for the workshop.', blocks: 1 },
      { id: 'walls', title: 'Walls', story: 'Walls go up around the workbench.', blocks: 1 },
      { id: 'roof', title: 'Roof', story: 'A roof keeps the workshop dry.', blocks: 1 },
    ],
  },
  {
    id: 'demo-garden',
    name: 'Garden',
    summary: 'A small plot that grows with care.',
    isDemo: true,
    stages: [
      { id: 'soil', title: 'Soil', story: 'The ground is turned and ready.', blocks: 1 },
      { id: 'seeds', title: 'Seeds', story: 'The first seeds are planted in rows.', blocks: 1 },
      { id: 'bloom', title: 'Bloom', story: 'The first flowers open.', blocks: 2 },
    ],
  },
  {
    id: 'demo-lookout',
    name: 'Lookout',
    summary: 'A tall spot with a view over the village.',
    isDemo: true,
    stages: [
      { id: 'base', title: 'Base', story: 'A wide base steadies the tower.', blocks: 2 },
      { id: 'tower', title: 'Tower', story: 'The tower rises above the trees.', blocks: 2 },
      { id: 'lantern', title: 'Lantern', story: 'A lantern is hung at the top.', blocks: 2 },
    ],
  },
  {
    id: 'demo-bridge',
    name: 'Bridge',
    summary: 'A way across the stream.',
    isDemo: true,
    stages: [
      { id: 'posts', title: 'Posts', story: 'Strong posts are set on both banks.', blocks: 2 },
      { id: 'planks', title: 'Planks', story: 'Planks span the water.', blocks: 3 },
      { id: 'rails', title: 'Rails', story: 'Rails make the crossing steady.', blocks: 3 },
    ],
  },
];

export type StageStatus = 'built' | 'current' | 'later';

export interface StageState {
  structureId: string;
  stage: VillageStageDef;
  status: StageStatus;
  /** Blocks placed on this stage, 0 up to its cost. */
  blocksPlaced: number;
}

export type StructureStatus = 'notStarted' | 'building' | 'complete';

export interface StructureState {
  structure: VillageStructureDef;
  stages: StageState[];
  status: StructureStatus;
  blocksPlaced: number;
  blocksNeeded: number;
  builtStages: number;
}

export interface NextGoal {
  structureName: string;
  stageTitle: string;
  blocksToGo: number;
}

export interface VillageState {
  structures: StructureState[];
  blocksEarned: number;
  blocksPlaced: number;
  blocksNeeded: number;
  /** Blocks earned beyond what the village can use yet; they are kept, never lost. */
  blocksSaved: number;
  builtStages: number;
  complete: boolean;
  next: NextGoal | null;
}

function wholeBlocks(blocks: number): number {
  return Number.isFinite(blocks) && blocks > 0 ? Math.floor(blocks) : 0;
}

/** The village for a number of blocks earned. */
export function buildVillage(blocksEarned: number, definitions: readonly VillageStructureDef[] = VILLAGE): VillageState {
  const earned = wholeBlocks(blocksEarned);
  let remaining = earned;
  let next: NextGoal | null = null;
  let builtTotal = 0;
  let neededTotal = 0;

  const structures: StructureState[] = definitions.map((structure) => {
    let structurePlaced = 0;
    let built = 0;
    const stages: StageState[] = structure.stages.map((stage) => {
      const placed = Math.min(remaining, stage.blocks);
      remaining -= placed;
      structurePlaced += placed;
      const isBuilt = placed === stage.blocks;
      if (isBuilt) built++;
      let status: StageStatus = 'later';
      if (isBuilt) status = 'built';
      else if (next === null) {
        status = 'current';
        next = { structureName: structure.name, stageTitle: stage.title, blocksToGo: stage.blocks - placed };
      }
      return { structureId: structure.id, stage, status, blocksPlaced: placed };
    });

    const needed = structure.stages.reduce((sum, s) => sum + s.blocks, 0);
    builtTotal += built;
    neededTotal += needed;
    return {
      structure,
      stages,
      status: structurePlaced === 0 ? 'notStarted' : structurePlaced === needed ? 'complete' : 'building',
      blocksPlaced: structurePlaced,
      blocksNeeded: needed,
      builtStages: built,
    };
  });

  return {
    structures,
    blocksEarned: earned,
    blocksPlaced: earned - remaining,
    blocksNeeded: neededTotal,
    blocksSaved: remaining,
    builtStages: builtTotal,
    complete: next === null,
    next,
  };
}

export interface BuiltStage {
  structureName: string;
  stage: VillageStageDef;
}

/** The stages built when going from `seenBlocks` to `currentBlocks`, in building order. Empty if nothing new. */
export function stagesBuiltBetween(
  seenBlocks: number,
  currentBlocks: number,
  definitions: readonly VillageStructureDef[] = VILLAGE,
): BuiltStage[] {
  const before = buildVillage(seenBlocks, definitions);
  const after = buildVillage(currentBlocks, definitions);
  const built: BuiltStage[] = [];
  after.structures.forEach((structure, si) => {
    structure.stages.forEach((stage, gi) => {
      if (stage.status === 'built' && before.structures[si].stages[gi].status !== 'built') {
        built.push({ structureName: structure.structure.name, stage: stage.stage });
      }
    });
  });
  return built;
}

/** A calm note about stages built since the village was last viewed, or null if there are none. */
export function describeVillageGrowth(newStages: number): string | null {
  if (!Number.isInteger(newStages) || newStages < 1) return null;
  return `${newStages} new ${newStages === 1 ? 'stage' : 'stages'} in the village.`;
}

/** Plain words for a stage, so its state is never shown by color alone. */
export function describeStageStatus(stage: StageState): string {
  switch (stage.status) {
    case 'built':
      return 'Built';
    case 'current':
      return stage.blocksPlaced > 0
        ? `Next · ${stage.stage.blocks - stage.blocksPlaced} more ${stage.stage.blocks - stage.blocksPlaced === 1 ? 'block' : 'blocks'}`
        : `Next · ${stage.stage.blocks} ${stage.stage.blocks === 1 ? 'block' : 'blocks'}`;
    case 'later':
      return 'Later';
  }
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

/** Plain words for what comes next, or a calm note if the village is finished for now. */
export function describeNextGoal(state: VillageState): string {
  if (!state.next) {
    return state.blocksSaved > 0
      ? `The village is complete for now. ${state.blocksSaved} ${state.blocksSaved === 1 ? 'block is' : 'blocks are'} saved for what comes next.`
      : 'The village is complete for now.';
  }
  const { structureName, stageTitle, blocksToGo } = state.next;
  return `Next: ${structureName} · ${stageTitle}, ${blocksToGo} more ${blocksToGo === 1 ? 'block' : 'blocks'}.`;
}
