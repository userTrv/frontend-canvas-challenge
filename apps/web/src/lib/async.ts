export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RetryOptions {
  attempts: number;
  delayMs: number;
  shouldRetry: (error: unknown) => boolean;
  signal?: AbortSignal;
}

export async function withRetry<T>(run: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= options.attempts || !options.shouldRetry(error)) throw error;
      await sleep(options.delayMs * attempt, options.signal);
    }
  }
}

export interface PollOptions<T> {
  isDone: (value: T) => boolean;
  delayMs: number;
  firstDelayMs?: number;
  signal: AbortSignal;
  onValue?: (value: T) => void;
  onError?: (error: unknown) => boolean;
}

export async function pollUntil<T>(
  load: (signal: AbortSignal) => Promise<T>,
  { isDone, delayMs, firstDelayMs = delayMs, signal, onValue, onError }: PollOptions<T>,
): Promise<T> {
  for (let wait = firstDelayMs; ; wait = delayMs) {
    await sleep(wait, signal);
    let value: T;
    try {
      value = await load(signal);
    } catch (error) {
      if (!signal.aborted && onError?.(error)) continue;
      throw error;
    }
    onValue?.(value);
    if (isDone(value)) return value;
  }
}
