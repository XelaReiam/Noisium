import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getNoisiumChannel, resetNoisiumChannel } from './broadcastChannel';

describe('broadcastChannel singleton', () => {
  beforeEach(() => {
    resetNoisiumChannel();
  });

  afterEach(() => {
    resetNoisiumChannel();
  });

  it('returns a BroadcastChannel with name "noisium"', () => {
    const ch = getNoisiumChannel();
    expect(ch).toBeInstanceOf(BroadcastChannel);
    expect(ch.name).toBe('noisium');
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    const a = getNoisiumChannel();
    const b = getNoisiumChannel();
    expect(a).toBe(b);
  });

  it('after reset, returns a fresh instance', () => {
    const a = getNoisiumChannel();
    resetNoisiumChannel();
    const b = getNoisiumChannel();
    expect(a).not.toBe(b);
  });

  it('mock channel exposes _simulateMessage for tests', () => {
    const ch = getNoisiumChannel();
    let received: unknown = null;
    ch.addEventListener('message', (e) => {
      received = (e as MessageEvent).data;
    });
    // The mock's _simulateMessage is private API for tests:
    (ch as unknown as { _simulateMessage: (d: unknown) => void })._simulateMessage({ foo: 'bar' });
    expect(received).toEqual({ foo: 'bar' });
  });
});
