import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveQueue, type SaveState } from './save-queue';

class Conflict extends Error {}

function setup() {
  let value = 0;
  const writes: number[] = [];
  const states: SaveState[] = [];
  let pending: { resolve: () => void; reject: (error: unknown) => void } | null = null;
  const queue = new SaveQueue<number>({
    delayMs: 500,
    read: () => value,
    write: (snapshot) => {
      writes.push(snapshot);
      return new Promise<void>((resolve, reject) => (pending = { resolve, reject }));
    },
    isBlocking: (error) => error instanceof Conflict,
    onChange: (state) => states.push(state),
  });
  const edit = (next: number) => {
    value = next;
    queue.schedule();
  };
  const settle = async (error?: unknown) => {
    const current = pending!;
    pending = null;
    if (error) current.reject(error);
    else current.resolve();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { queue, edit, writes, states, settle, hasPending: () => pending !== null };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SaveQueue', () => {
  it('turns a burst of edits into one save of the last state after the pause', async () => {
    const { edit, writes, states, settle } = setup();
    edit(1);
    await vi.advanceTimersByTimeAsync(300);
    edit(2);
    await vi.advanceTimersByTimeAsync(300);
    edit(3);
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(writes).toEqual([3]);
    await settle();
    expect(states).toEqual(['unsaved', 'saving', 'saved']);
  });

  it('never overlaps saves and sends edits made during a request afterwards', async () => {
    const { edit, writes, settle, hasPending } = setup();
    edit(1);
    await vi.advanceTimersByTimeAsync(500);
    edit(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(writes).toEqual([1]);
    await settle();
    expect(writes).toEqual([1, 2]);
    await settle();
    expect(hasPending()).toBe(false);
  });

  it('flush skips the timer and waits for the save in flight', async () => {
    const { queue, edit, writes, settle } = setup();
    edit(1);
    await vi.advanceTimersByTimeAsync(500);
    edit(2);
    let flushed = false;
    void queue.flush().then(() => (flushed = true));
    await settle();
    expect(writes).toEqual([1, 2]);
    expect(flushed).toBe(false);
    await settle();
    expect(flushed).toBe(true);
  });

  it('keeps changes after a failed save and rejects the flush', async () => {
    const { queue, edit, writes, states, settle } = setup();
    edit(1);
    const flushed = queue.flush();
    flushed.catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    await settle(new Error('offline'));
    await expect(flushed).rejects.toThrow('offline');
    expect(states.at(-1)).toBe('error');
    expect(queue.hasPendingChanges).toBe(true);

    const retried = queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    await retried;
    expect(writes).toEqual([1, 1]);
    expect(states.at(-1)).toBe('saved');
  });

  it('stops saving on a blocking error until retry or reset', async () => {
    const { queue, edit, writes, states, settle } = setup();
    edit(1);
    await vi.advanceTimersByTimeAsync(500);
    await settle(new Conflict());
    expect(states.at(-1)).toBe('conflict');

    edit(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toEqual([1]);
    await expect(queue.flush()).rejects.toBeInstanceOf(Conflict);

    void queue.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toEqual([1, 2]);
    await settle();
    expect(states.at(-1)).toBe('saved');
  });
});
