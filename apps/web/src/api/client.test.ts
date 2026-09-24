import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './client';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

function mockFetch(result: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('sends JSON with conditional and idempotency headers and returns data with metadata', async () => {
    const fetchMock = mockFetch(
      json({ id: 1 }, { status: 202, headers: { ETag: '"abc"', 'Retry-After': '1' } }),
    );
    const response = await request<{ id: number }>('/api/x', {
      method: 'PUT',
      body: { a: 1 },
      ifMatch: '"old"',
      idempotencyKey: 'key-12345',
    });

    expect(response).toEqual({ data: { id: 1 }, status: 202, etag: '"abc"', retryAfterMs: 1000 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:4001/api/x');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'If-Match': '"old"',
      'Idempotency-Key': 'key-12345',
    });
  });

  it('unwraps the error envelope of an HTTP error', async () => {
    mockFetch(
      json(
        { error: { code: 'INVALID_GRAPH', message: 'Неверный граф.' } },
        { status: 422, headers: { 'X-Request-Id': 'req-1' } },
      ),
    );
    const error = await failure(request('/api/x'));
    expect(error).toMatchObject({
      kind: 'http',
      code: 'INVALID_GRAPH',
      status: 422,
      message: 'Неверный граф.',
      requestId: 'req-1',
    });
  });

  it('keeps an HTTP error when the error body is not JSON', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await failure(request('/api/x'));
    expect(error).toMatchObject({ kind: 'http', code: 'HTTP_502', status: 502 });
  });

  it('reports network, parse and empty-body failures as ApiError', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await failure(request('/api/x'))).toMatchObject({ kind: 'network' });

    mockFetch(new Response('not json', { status: 200 }));
    expect(await failure(request('/api/x'))).toMatchObject({ kind: 'parse', code: 'INVALID_JSON' });

    mockFetch(new Response(null, { status: 200 }));
    expect(await failure(request('/api/x'))).toMatchObject({
      kind: 'parse',
      code: 'EMPTY_RESPONSE',
    });
  });

  it('marks aborted requests so callers can ignore them', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch(new DOMException('aborted', 'AbortError'));
    const error = await failure(request('/api/x', { signal: controller.signal }));
    expect(error.kind).toBe('aborted');
  });
});
