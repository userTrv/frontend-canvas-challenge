export class IdempotencyKeys {
  private readonly pending = new Map<string, { key: string; payload: string }>();

  keyFor(scope: string, payload: unknown): string {
    const serialized = JSON.stringify(payload);
    const current = this.pending.get(scope);
    if (current?.payload === serialized) return current.key;
    const key = crypto.randomUUID();
    this.pending.set(scope, { key, payload: serialized });
    return key;
  }

  settle(scope: string): void {
    this.pending.delete(scope);
  }
}
