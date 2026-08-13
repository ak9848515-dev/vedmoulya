import { describe, expect, it } from 'vitest';
import { SystemClock } from '../SystemClock.js';

describe('SystemClock', () => {
  it('returns ISO timestamps and monotonic millisecond reads', () => {
    const clock = new SystemClock();
    const iso = clock.now();
    expect(new Date(iso).getTime()).not.toBeNaN();
    const a = clock.timestampMs();
    const b = clock.timestampMs();
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it('sleeps for the requested duration', async () => {
    const clock = new SystemClock();
    const startedAt = Date.now();
    await clock.sleep(20);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(18);
  });
});
