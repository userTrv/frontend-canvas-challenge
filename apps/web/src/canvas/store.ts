import { createStore } from 'zustand/vanilla';
import type { Viewport } from '@xyflow/react';
import type { ApiError } from '../api/client';
import type { SaveState } from '../lib/save-queue';
import { EMPTY_GENERATIONS, type GenerationIndex } from './generations';
import type { CanvasEdge, CanvasNode } from './graph';

export type LoadState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: ApiError };

export interface SaveStatus {
  state: SaveState;
  error: ApiError | null;
}

export type LaunchState =
  { status: 'starting' } | { status: 'error'; stage: 'save' | 'start' | 'poll'; error: ApiError };

export interface CanvasState {
  load: LoadState;
  title: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  revision: number;
  save: SaveStatus;
  generations: GenerationIndex;
  launches: ReadonlyMap<string, LaunchState>;
}

export const createCanvasStore = () =>
  createStore<CanvasState>()(() => ({
    load: { status: 'loading' },
    title: '',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    revision: 0,
    save: { state: 'saved', error: null },
    generations: EMPTY_GENERATIONS,
    launches: new Map(),
  }));

export type CanvasStore = ReturnType<typeof createCanvasStore>;
