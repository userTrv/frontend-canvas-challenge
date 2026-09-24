import type { CanvasEdge, CanvasNode, NodeType } from './graph';

const NEXT: Record<NodeType, NodeType | null> = {
  prompt: 'generator',
  generator: 'result',
  result: null,
};

export interface ConnectionIndex {
  typeById: Map<string, NodeType>;
  usedInputs: Set<string>;
  usedOutputs: Set<string>;
}

export interface Endpoints {
  source: string;
  target: string;
}

export function buildConnectionIndex(nodes: CanvasNode[], edges: CanvasEdge[]): ConnectionIndex {
  const typeById = new Map<string, NodeType>();
  for (const node of nodes) typeById.set(node.id, node.type);

  const usedInputs = new Set<string>();
  const usedOutputs = new Set<string>();
  for (const edge of edges) {
    usedInputs.add(edge.target);
    if (typeById.get(edge.source) === 'generator') usedOutputs.add(edge.source);
  }
  return { typeById, usedInputs, usedOutputs };
}

export function canConnect({ source, target }: Endpoints, index: ConnectionIndex): boolean {
  const sourceType = index.typeById.get(source);
  if (!sourceType || NEXT[sourceType] !== index.typeById.get(target)) return false;
  if (index.usedInputs.has(target)) return false;
  return sourceType !== 'generator' || !index.usedOutputs.has(source);
}
