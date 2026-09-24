import type { GenerationData, GenerationRequest } from '@canvas/contracts';
import { canvasApi } from '../api/canvas-api';
import { isAborted, isTransient, toApiError } from '../api/client';
import { POLL_INTERVAL_MS } from '../config';
import { pollUntil, withRetry } from '../lib/async';
import { IdempotencyKeys } from '../lib/idempotency';
import { indexGenerations, upsertGeneration } from './generations';
import type { CanvasStore, LaunchState } from './store';

export type Scenario = GenerationRequest['scenario'];

interface GenerationControllerOptions {
  spaceId: string;
  store: CanvasStore;
  signal: AbortSignal;
  saveGraph: () => Promise<string>;
}

const START_RETRY = { attempts: 3, delayMs: 1000, shouldRetry: isTransient };

export class GenerationController {
  private readonly keys = new IdempotencyKeys();
  private readonly starting = new Set<string>();

  constructor(private readonly options: GenerationControllerOptions) {}

  restore(newestFirst: GenerationData[]): void {
    this.options.store.setState({ generations: indexGenerations(newestFirst) });
    for (const generation of newestFirst)
      if (generation.status === 'processing') void this.track(generation);
  }

  start = async (generatorId: string, scenario: Scenario): Promise<void> => {
    if (this.starting.has(generatorId)) return;
    this.starting.add(generatorId);
    this.setLaunch(generatorId, { status: 'starting' });
    const { spaceId, signal } = this.options;
    let stage: 'save' | 'start' = 'save';
    try {
      const graphETag = await this.options.saveGraph();
      stage = 'start';
      const input: GenerationRequest = { nodeId: generatorId, graphETag, scenario };
      const key = this.keys.keyFor(generatorId, input);
      const started = await withRetry(
        () => canvasApi.startGeneration(spaceId, input, key, signal),
        { ...START_RETRY, signal },
      );
      this.keys.settle(generatorId);
      this.setLaunch(generatorId, null);
      void this.track(started.generation, started.retryAfterMs ?? POLL_INTERVAL_MS);
    } catch (error) {
      if (isAborted(error)) return;
      if (!isTransient(error)) this.keys.settle(generatorId);
      this.setLaunch(generatorId, { status: 'error', stage, error: toApiError(error) });
    } finally {
      this.starting.delete(generatorId);
    }
  };

  private async track(generation: GenerationData, firstDelayMs = POLL_INTERVAL_MS) {
    this.upsert(generation);
    if (generation.status !== 'processing') return;
    const { nodeId } = generation;
    try {
      await pollUntil((signal) => canvasApi.getGeneration(generation.links.self.href, signal), {
        signal: this.options.signal,
        firstDelayMs,
        delayMs: POLL_INTERVAL_MS,
        isDone: (current) => current.status !== 'processing',
        onValue: (current) => {
          this.setLaunch(nodeId, null);
          this.upsert(current);
        },
        onError: (error) => {
          if (!isTransient(error)) return false;
          this.setLaunch(nodeId, { status: 'error', stage: 'poll', error: toApiError(error) });
          return true;
        },
      });
    } catch (error) {
      if (!isAborted(error))
        this.setLaunch(nodeId, { status: 'error', stage: 'poll', error: toApiError(error) });
    }
  }

  private upsert(generation: GenerationData): void {
    this.options.store.setState((state) => {
      const generations = upsertGeneration(state.generations, generation);
      return generations === state.generations ? state : { generations };
    });
  }

  private setLaunch(generatorId: string, launch: LaunchState | null): void {
    this.options.store.setState((state) => {
      if (!launch && !state.launches.has(generatorId)) return state;
      const launches = new Map(state.launches);
      if (launch) launches.set(generatorId, launch);
      else launches.delete(generatorId);
      return { launches };
    });
  }
}
