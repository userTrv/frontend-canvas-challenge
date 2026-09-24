import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollUntil, withRetry } from './async';
import { IdempotencyKeys } from './idempotency';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('withRetry', () => {
  it('repeats retryable failures and gives up on others', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('ok');
    const result = withRetry(run, { attempts: 3, delayMs: 100, shouldRetry: () => true });
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);

    const fatal = vi.fn(() => Promise.reject(new Error('422')));
    await expect(
      withRetry(fatal, { attempts: 3, delayMs: 100, shouldRetry: () => false }),
    ).rejects.toThrow('422');
    expect(fatal).toHaveBeenCalledTimes(1);
  });
});

describe('pollUntil', () => {
  it('polls until done and reports every value', async () => {
    const statuses = ['processing', 'processing', 'succeeded'];
    const seen: string[] = [];
    const result = pollUntil(async () => statuses.shift()!, {
      isDone: (status) => status !== 'processing',
      delayMs: 500,
      signal: new AbortController().signal,
      onValue: (status) => seen.push(status),
    });
    await vi.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toBe('succeeded');
    expect(seen).toEqual(['processing', 'processing', 'succeeded']);
  });

  it('keeps polling through errors the caller accepts', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('succeeded');
    const errors: unknown[] = [];
    const result = pollUntil(load, {
      isDone: () => true,
      delayMs: 500,
      signal: new AbortController().signal,
      onError: (error) => errors.push(error) > 0,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('succeeded');
    expect(errors).toHaveLength(1);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const load = vi.fn(async () => 'processing');
    const result = pollUntil(load, {
      isDone: () => false,
      delayMs: 500,
      signal: controller.signal,
    });
    result.catch(() => {});
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    const calls = load.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(calls);
  });
});

describe('IdempotencyKeys', () => {
  it('reuses the key for the same payload until settled', () => {
    const keys = new IdempotencyKeys();
    const first = keys.keyFor('node', { etag: '"a"' });
    expect(keys.keyFor('node', { etag: '"a"' })).toBe(first);
    expect(keys.keyFor('node', { etag: '"b"' })).not.toBe(first);
    const second = keys.keyFor('node', { etag: '"b"' });
    keys.settle('node');
    expect(keys.keyFor('node', { etag: '"b"' })).not.toBe(second);
  });
});
