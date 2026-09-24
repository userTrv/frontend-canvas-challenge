import type { GenerationData, GenerationRequest, GraphData, SpaceData } from '@canvas/contracts';
import { request, requireETag } from './client';

export interface VersionedGraph {
  graph: GraphData;
  etag: string;
}

export interface StartedGeneration {
  generation: GenerationData;
  retryAfterMs: number | null;
}

const spacePath = (spaceId: string) => `/api/spaces/${encodeURIComponent(spaceId)}`;

export const canvasApi = {
  async listSpaces(signal?: AbortSignal): Promise<SpaceData[]> {
    return (await request<SpaceData[]>('/api/spaces', { signal })).data;
  },

  async createSpace(title: string): Promise<SpaceData> {
    return (await request<SpaceData>('/api/spaces', { method: 'POST', body: { title } })).data;
  },

  async getSpace(spaceId: string, signal?: AbortSignal): Promise<SpaceData> {
    return (await request<SpaceData>(spacePath(spaceId), { signal })).data;
  },

  async getGraph(spaceId: string, signal?: AbortSignal): Promise<VersionedGraph> {
    const response = await request<GraphData>(`${spacePath(spaceId)}/graph`, { signal });
    return { graph: response.data, etag: requireETag(response) };
  },

  async saveGraph(
    spaceId: string,
    graph: GraphData,
    etag: string,
    signal?: AbortSignal,
  ): Promise<VersionedGraph> {
    const response = await request<GraphData>(`${spacePath(spaceId)}/graph`, {
      method: 'PUT',
      body: graph,
      ifMatch: etag,
      signal,
    });
    return { graph: response.data, etag: requireETag(response) };
  },

  async listGenerations(spaceId: string, signal?: AbortSignal): Promise<GenerationData[]> {
    return (await request<GenerationData[]>(`${spacePath(spaceId)}/generations`, { signal })).data;
  },

  async startGeneration(
    spaceId: string,
    input: GenerationRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<StartedGeneration> {
    const response = await request<GenerationData>(`${spacePath(spaceId)}/generations`, {
      method: 'POST',
      body: input,
      idempotencyKey,
      signal,
    });
    return { generation: response.data, retryAfterMs: response.retryAfterMs };
  },

  async getGeneration(href: string, signal?: AbortSignal): Promise<GenerationData> {
    return (await request<GenerationData>(href, { signal })).data;
  },
};
