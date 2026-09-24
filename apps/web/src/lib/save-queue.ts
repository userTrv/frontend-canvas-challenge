export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

export interface SaveQueueOptions<T> {
  delayMs: number;
  read: () => T;
  write: (snapshot: T) => Promise<void>;
  isBlocking: (error: unknown) => boolean;
  onChange: (state: SaveState, error: unknown) => void;
}

export class SaveQueue<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private tail: Promise<void> = Promise.resolve();
  private dirty = false;
  private inFlight = false;
  private error: unknown = null;
  private blocked = false;
  private disposed = false;
  private state: SaveState = 'saved';
  private reportedError: unknown = null;

  constructor(private readonly options: SaveQueueOptions<T>) {}

  schedule(): void {
    if (this.disposed) return;
    this.dirty = true;
    this.emit();
    if (this.blocked) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush().catch(() => {}), this.options.delayMs);
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const run = this.tail.then(() => this.saveDirty());
    this.tail = run.catch(() => {});
    return run;
  }

  retry(): Promise<void> {
    this.blocked = false;
    return this.flush();
  }

  reset(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.dirty = false;
    this.blocked = false;
    this.error = null;
    this.emit();
  }

  get hasPendingChanges(): boolean {
    return this.dirty || this.inFlight;
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposed = true;
  }

  private async saveDirty(): Promise<void> {
    if (this.blocked) throw this.error;
    if (!this.dirty) return;
    const snapshot = this.options.read();
    this.dirty = false;
    this.inFlight = true;
    this.error = null;
    this.emit();
    try {
      await this.options.write(snapshot);
    } catch (error) {
      this.dirty = true;
      this.error = error;
      this.blocked = this.options.isBlocking(error);
      throw error;
    } finally {
      this.inFlight = false;
      this.emit();
    }
  }

  private emit(): void {
    const state: SaveState = this.blocked
      ? 'conflict'
      : this.inFlight
        ? 'saving'
        : this.error
          ? 'error'
          : this.dirty
            ? 'unsaved'
            : 'saved';
    if (state === this.state && this.error === this.reportedError) return;
    this.state = state;
    this.reportedError = this.error;
    this.options.onChange(state, this.error);
  }
}
