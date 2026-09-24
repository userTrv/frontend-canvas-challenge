import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from '@xyflow/react';
import type { GraphData } from '@canvas/contracts';
import { canvasApi, type VersionedGraph } from '../api/canvas-api';
import { ApiError, isAborted, toApiError } from '../api/client';
import { SAVE_DEBOUNCE_MS } from '../config';
import { SaveQueue } from '../lib/save-queue';
import { buildConnectionIndex, canConnect, type ConnectionIndex } from './connections';
import { GenerationController } from './generation-controller';
import {
  createNode,
  fromGraphData,
  isPersistentChange,
  toGraphData,
  type CanvasEdge,
  type CanvasNode,
  type NodeType,
} from './graph';
import { createCanvasStore } from './store';

export class CanvasSession {
  readonly store = createCanvasStore();
  private readonly lifetime = new AbortController();
  private etag = '';
  private unconfirmedSave: GraphData | null = null;
  private readonly saves = new SaveQueue<GraphData>({
    delayMs: SAVE_DEBOUNCE_MS,
    read: () => toGraphData(this.store.getState()),
    write: (graph) => this.writeGraph(graph),
    isBlocking: isVersionConflict,
    onChange: (state, error) =>
      this.store.setState({ save: { state, error: error ? toApiError(error) : null } }),
  });
  readonly generations: GenerationController;
  private connectionCache: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    index: ConnectionIndex;
  } | null = null;

  constructor(readonly spaceId: string) {
    this.generations = new GenerationController({
      spaceId,
      store: this.store,
      signal: this.lifetime.signal,
      saveGraph: async () => {
        await this.saves.flush();
        return this.etag;
      },
    });
  }

  async load(): Promise<void> {
    const { signal } = this.lifetime;
    this.store.setState({ load: { status: 'loading' } });
    try {
      const [space, graph, generations] = await Promise.all([
        canvasApi.getSpace(this.spaceId, signal),
        canvasApi.getGraph(this.spaceId, signal),
        canvasApi.listGenerations(this.spaceId, signal),
      ]);
      this.store.setState({ load: { status: 'ready' }, title: space.title });
      this.applyServerGraph(graph);
      this.generations.restore(generations);
    } catch (error) {
      if (!isAborted(error))
        this.store.setState({ load: { status: 'error', error: toApiError(error) } });
    }
  }

  onNodesChange = (changes: NodeChange<CanvasNode>[]): void => {
    this.store.setState((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
    if (changes.some(isPersistentChange)) this.saves.schedule();
  };

  onEdgesChange = (changes: EdgeChange<CanvasEdge>[]): void => {
    this.store.setState((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
    if (changes.some(isPersistentChange)) this.saves.schedule();
  };

  onViewportChange = (viewport: Viewport): void => {
    const current = this.store.getState().viewport;
    if (current.x === viewport.x && current.y === viewport.y && current.zoom === viewport.zoom)
      return;
    this.store.setState({ viewport });
    this.saves.schedule();
  };

  isValidConnection = (connection: Connection | CanvasEdge): boolean =>
    canConnect(connection, this.connectionIndex());

  private connectionIndex(): ConnectionIndex {
    const { nodes, edges } = this.store.getState();
    let cache = this.connectionCache;
    if (cache?.nodes !== nodes || cache.edges !== edges) {
      cache = { nodes, edges, index: buildConnectionIndex(nodes, edges) };
      this.connectionCache = cache;
    }
    return cache.index;
  }

  onConnect = (connection: Connection): void => {
    if (!this.isValidConnection(connection)) return;
    const edge = { id: crypto.randomUUID(), source: connection.source, target: connection.target };
    this.store.setState((state) => ({ edges: [...state.edges, edge] }));
    this.saves.schedule();
  };

  addNode = (type: NodeType, position: XYPosition): void => {
    this.store.setState((state) => ({ nodes: [...state.nodes, createNode(type, position)] }));
    this.saves.schedule();
  };

  addChain = (origin: XYPosition): void => {
    const prompt = createNode('prompt', origin);
    const generator = createNode('generator', { x: origin.x + 320, y: origin.y });
    const result = createNode('result', { x: origin.x + 640, y: origin.y });
    this.store.setState((state) => ({
      nodes: [...state.nodes, prompt, generator, result],
      edges: [
        ...state.edges,
        { id: crypto.randomUUID(), source: prompt.id, target: generator.id },
        { id: crypto.randomUUID(), source: generator.id, target: result.id },
      ],
    }));
    this.saves.schedule();
  };

  setPromptText = (nodeId: string, text: string): void => {
    this.store.setState((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId && node.type === 'prompt' ? { ...node, data: { text } } : node,
      ),
    }));
    this.saves.schedule();
  };

  get hasUnsavedChanges(): boolean {
    return this.saves.hasPendingChanges;
  }

  retrySave = (): void => {
    void this.saves.retry().catch(() => {});
  };

  reloadFromServer = async (): Promise<void> => {
    this.applyServerGraph(await canvasApi.getGraph(this.spaceId, this.lifetime.signal));
  };

  overwriteServer = async (): Promise<void> => {
    this.etag = (await canvasApi.getGraph(this.spaceId, this.lifetime.signal)).etag;
    this.unconfirmedSave = null;
    await this.saves.retry();
  };

  private applyServerGraph({ graph, etag }: VersionedGraph): void {
    this.etag = etag;
    this.unconfirmedSave = null;
    this.saves.reset();
    this.store.setState((state) => ({
      ...fromGraphData(graph),
      revision: state.revision + 1,
    }));
  }

  private async writeGraph(graph: GraphData): Promise<void> {
    if (this.unconfirmedSave) await this.confirmLostSave(this.unconfirmedSave);
    try {
      this.etag = (await canvasApi.saveGraph(this.spaceId, graph, this.etag)).etag;
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'network') this.unconfirmedSave = graph;
      throw error;
    }
  }

  private async confirmLostSave(sent: GraphData): Promise<void> {
    const server = await canvasApi.getGraph(this.spaceId);
    if (server.etag !== this.etag && JSON.stringify(server.graph) === JSON.stringify(sent))
      this.etag = server.etag;
    this.unconfirmedSave = null;
  }

  dispose(): void {
    if (this.saves.hasPendingChanges) void this.saves.flush().catch(() => {});
    this.saves.dispose();
    this.lifetime.abort();
  }
}

const isVersionConflict = (error: unknown) => error instanceof ApiError && error.status === 412;
