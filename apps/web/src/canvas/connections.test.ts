import { describe, expect, it } from 'vitest';
import { buildConnectionIndex, canConnect } from './connections';
import { createNode, type CanvasEdge, type NodeType } from './graph';

const at = { x: 0, y: 0 };
const make = (type: NodeType) => createNode(type, at);
const edge = (source: string, target: string): CanvasEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe('connection rules', () => {
  const prompt = make('prompt');
  const prompt2 = make('prompt');
  const generator = make('generator');
  const generator2 = make('generator');
  const result = make('result');
  const result2 = make('result');
  const nodes = [prompt, prompt2, generator, generator2, result, result2];

  it('allows only prompt → generator → result', () => {
    const index = buildConnectionIndex(nodes, []);
    expect(canConnect({ source: prompt.id, target: generator.id }, index)).toBe(true);
    expect(canConnect({ source: generator.id, target: result.id }, index)).toBe(true);
    expect(canConnect({ source: prompt.id, target: result.id }, index)).toBe(false);
    expect(canConnect({ source: generator.id, target: prompt.id }, index)).toBe(false);
    expect(canConnect({ source: result.id, target: generator.id }, index)).toBe(false);
    expect(canConnect({ source: generator.id, target: generator2.id }, index)).toBe(false);
    expect(canConnect({ source: prompt.id, target: 'missing' }, index)).toBe(false);
  });

  it('keeps one edge per input and one result per generator', () => {
    const index = buildConnectionIndex(nodes, [
      edge(prompt.id, generator.id),
      edge(generator.id, result.id),
    ]);
    expect(canConnect({ source: prompt2.id, target: generator.id }, index)).toBe(false);
    expect(canConnect({ source: generator2.id, target: result.id }, index)).toBe(false);
    expect(canConnect({ source: generator.id, target: result2.id }, index)).toBe(false);
    expect(canConnect({ source: prompt.id, target: generator2.id }, index)).toBe(true);
  });
});
