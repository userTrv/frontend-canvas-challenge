import type { GenerationData } from '@canvas/contracts';

export interface GenerationIndex {
  byGenerator: ReadonlyMap<string, GenerationData>;
  byResult: ReadonlyMap<string, GenerationData>;
}

export function indexGenerations(newestFirst: GenerationData[]): GenerationIndex {
  const byGenerator = new Map<string, GenerationData>();
  const byResult = new Map<string, GenerationData>();
  for (const generation of newestFirst) {
    if (!byGenerator.has(generation.nodeId)) byGenerator.set(generation.nodeId, generation);
    if (!byResult.has(generation.resultNodeId)) byResult.set(generation.resultNodeId, generation);
  }
  return { byGenerator, byResult };
}

function replaces(current: GenerationData | undefined, next: GenerationData): boolean {
  if (!current) return true;
  if (current.id === next.id) return current.status !== next.status;
  return next.createdAt > current.createdAt;
}

export function upsertGeneration(
  index: GenerationIndex,
  generation: GenerationData,
): GenerationIndex {
  const forGenerator = replaces(index.byGenerator.get(generation.nodeId), generation);
  const forResult = replaces(index.byResult.get(generation.resultNodeId), generation);
  if (!forGenerator && !forResult) return index;
  return {
    byGenerator: forGenerator
      ? new Map(index.byGenerator).set(generation.nodeId, generation)
      : index.byGenerator,
    byResult: forResult
      ? new Map(index.byResult).set(generation.resultNodeId, generation)
      : index.byResult,
  };
}

export const EMPTY_GENERATIONS: GenerationIndex = { byGenerator: new Map(), byResult: new Map() };
