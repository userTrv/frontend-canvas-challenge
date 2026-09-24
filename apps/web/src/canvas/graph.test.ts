import { describe, expect, it } from 'vitest';
import { toGraphData, type CanvasEdge, type CanvasNode } from './graph';

describe('toGraphData', () => {
  it('keeps only schema fields and drops React Flow runtime state', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'p',
        type: 'prompt',
        position: { x: 1, y: 2 },
        data: { text: 'Горы' },
        selected: true,
        dragging: true,
        measured: { width: 240, height: 120 },
      },
      { id: 'g', type: 'generator', position: { x: 3, y: 4 }, data: { label: 'Генератор' } },
    ];
    const edges: CanvasEdge[] = [{ id: 'e', source: 'p', target: 'g', selected: true }];

    expect(toGraphData({ nodes, edges, viewport: { x: 5, y: 6, zoom: 1.5 } })).toEqual({
      nodes: [
        { id: 'p', type: 'prompt', position: { x: 1, y: 2 }, data: { text: 'Горы' } },
        { id: 'g', type: 'generator', position: { x: 3, y: 4 }, data: { label: 'Генератор' } },
      ],
      edges: [{ id: 'e', source: 'p', target: 'g' }],
      viewport: { x: 5, y: 6, zoom: 1.5 },
    });
  });
});
