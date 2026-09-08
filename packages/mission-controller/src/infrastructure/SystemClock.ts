// System clock implementation
export class SystemClock {
  now(): string {
    return new Date().toISOString();
  }
  timestampMs(): number {
    return Date.now();
  }
}
