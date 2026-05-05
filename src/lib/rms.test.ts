import { describe, it, expect } from 'vitest';
import { computeRms } from './rms';

describe('computeRms', () => {
  it('returns 0 for an all-zero buffer', () => {
    const buf = new Float32Array(1024);
    expect(computeRms(buf)).toBe(0);
  });

  it('returns 0 for an empty buffer (no NaN)', () => {
    expect(computeRms(new Float32Array(0))).toBe(0);
  });

  it('returns ~0.707 for a unit-amplitude sine wave (1/sqrt(2))', () => {
    const N = 4096;
    const buf = new Float32Array(N);
    // 4 full cycles within the buffer — exact integer cycles avoid edge effects
    for (let i = 0; i < N; i++) {
      buf[i] = Math.sin((2 * Math.PI * i * 4) / N);
    }
    const expected = 1 / Math.sqrt(2);
    expect(computeRms(buf)).toBeCloseTo(expected, 3);
  });

  it('returns ~0.5 for a square wave alternating between +0.5 and -0.5', () => {
    const N = 1024;
    const buf = new Float32Array(N);
    for (let i = 0; i < N; i++) buf[i] = i % 2 === 0 ? 0.5 : -0.5;
    expect(computeRms(buf)).toBeCloseTo(0.5, 6);
  });

  it('returns ~1.0 for a constant DC buffer at +1.0 (clipping check)', () => {
    const buf = new Float32Array(512).fill(1);
    expect(computeRms(buf)).toBeCloseTo(1.0, 6);
  });
});
