import type { Edge, EdgeChange, Node, NodeChange, Viewport, XYPosition } from '@xyflow/react';
import type { GraphData, NodeData } from '@canvas/contracts';

export type NodeType = NodeData['type'];
export type PromptNode = Node<{ text: string }, 'prompt'>;
export type GeneratorNode = Node<{ label: string }, 'generator'>;
export type ResultNode = Node<{ label: string }, 'result'>;
export type CanvasNode = PromptNode | GeneratorNode | ResultNode;
export type CanvasEdge = Edge;

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
}

export function fromGraphData(graph: GraphData): CanvasGraph {
  return { nodes: graph.nodes, edges: graph.edges, viewport: graph.viewport };
}

export function toGraphData({ nodes, edges, viewport }: CanvasGraph): GraphData {
  return {
    nodes: nodes.map(toNodeData),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
  };
}

function toNodeData(node: CanvasNode): NodeData {
  const { id, position } = node;
  const xy = { x: position.x, y: position.y };
  switch (node.type) {
    case 'prompt':
      return { id, type: node.type, position: xy, data: { text: node.data.text } };
    case 'generator':
    case 'result':
      return { id, type: node.type, position: xy, data: { label: node.data.label } };
  }
}

export function isPersistentChange(change: NodeChange | EdgeChange): boolean {
  return change.type !== 'select' && change.type !== 'dimensions';
}

interface NodeMeta {
  title: string;
  input: string | null;
  output: string | null;
}

export const NODE_META: Record<NodeType, NodeMeta> = {
  prompt: { title: 'Текст', input: null, output: 'Выход: текст для генератора' },
  generator: {
    title: 'Генератор',
    input: 'Вход: текст',
    output: 'Выход: изображение для результата',
  },
  result: { title: 'Результат', input: 'Вход: изображение от генератора', output: null },
};

export function createNode(type: NodeType, position: XYPosition): CanvasNode {
  const id = crypto.randomUUID();
  switch (type) {
    case 'prompt':
      return { id, type, position, data: { text: '' } };
    case 'generator':
      return { id, type, position, data: { label: NODE_META.generator.title } };
    case 'result':
      return { id, type, position, data: { label: NODE_META.result.title } };
  }
}
