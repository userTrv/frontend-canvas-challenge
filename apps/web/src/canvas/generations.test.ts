import { describe, expect, it } from 'vitest';
import type { GenerationData } from '@canvas/contracts';
import { EMPTY_GENERATIONS, indexGenerations, upsertGeneration } from './generations';

let seq = 0;
function generation(patch: Partial<GenerationData>): GenerationData {
  seq += 1;
  return {
    id: `g${seq}`,
    spaceId: 's',
    nodeId: 'gen',
    resultNodeId: 'res',
    prompt: 'text',
    graphETag: '"x"',
    scenario: 'success',
    status: 'processing',
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    imageUrl: null,
    failureCode: null,
    links: {},
    ...patch,
  };
}

describe('generation index', () => {
  it('keeps the newest generation per generator and per result node', () => {
    const older = generation({ status: 'failed' });
    const newer = generation({ status: 'succeeded', resultNodeId: 'other' });
    const index = indexGenerations([newer, older]);
    expect(index.byGenerator.get('gen')).toBe(newer);
    expect(index.byResult.get('res')).toBe(older);
    expect(index.byResult.get('other')).toBe(newer);
  });

  it('does not let a finished old run replace a newer one', () => {
    const old = generation({});
    const fresh = generation({ nodeId: 'gen2' });
    let index = upsertGeneration(EMPTY_GENERATIONS, old);
    index = upsertGeneration(index, fresh);
    index = upsertGeneration(index, { ...old, status: 'succeeded', imageUrl: '/a.svg' });
    expect(index.byResult.get('res')).toBe(fresh);
    expect(index.byGenerator.get('gen')?.status).toBe('succeeded');
  });

  it('returns the same index when the status did not change', () => {
    const run = generation({});
    const index = upsertGeneration(EMPTY_GENERATIONS, run);
    expect(upsertGeneration(index, { ...run })).toBe(index);
  });
});
