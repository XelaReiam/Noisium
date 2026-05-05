import { describe, it, expect } from 'vitest';
import {
  dbFsFromRms,
  computeDelta,
  getNormalizedScore,
  getDemoStatus,
  type Score,
} from './measurement';

describe('dbFsFromRms', () => {
  it('returns the default floor (-100) when rms is 0 (NOT -Infinity)', () => {
    const result = dbFsFromRms(0);
    expect(result).toBe(-100);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('returns the default floor for negative rms (defensive)', () => {
    expect(dbFsFromRms(-0.1)).toBe(-100);
  });

  it('returns 0 dBFS for full-scale rms (1.0)', () => {
    expect(dbFsFromRms(1)).toBe(0);
  });

  it('returns approximately -20 dBFS for rms=0.1', () => {
    expect(dbFsFromRms(0.1)).toBeCloseTo(-20, 1);
  });

  it('returns approximately -40 dBFS for rms=0.01', () => {
    expect(dbFsFromRms(0.01)).toBeCloseTo(-40, 1);
  });

  it('respects a custom floor', () => {
    expect(dbFsFromRms(0, -60)).toBe(-60);
    expect(dbFsFromRms(1e-10, -60)).toBe(-60); // would be -200 dBFS without clamp
  });
});

describe('computeDelta', () => {
  it('returns positive delta when measurement louder than baseline', () => {
    expect(computeDelta(-30, -50)).toBe(20);
  });

  it('returns negative delta when measurement quieter than baseline', () => {
    expect(computeDelta(-50, -30)).toBe(-20);
  });

  it('returns 0 when measurement equals baseline', () => {
    expect(computeDelta(-40, -40)).toBe(0);
  });
});

describe('getNormalizedScore', () => {
  it('returns 100 for the loudest delta (delta === maxDelta)', () => {
    expect(getNormalizedScore(20, 20)).toBe(100);
  });

  it('returns 50 for half the loudest delta', () => {
    expect(getNormalizedScore(10, 20)).toBe(50);
  });

  it('returns 0 (NOT NaN) when maxDeltaDb is exactly 0', () => {
    const result = getNormalizedScore(20, 0);
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('returns 0 when maxDeltaDb is negative', () => {
    expect(getNormalizedScore(-5, -1)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    expect(getNormalizedScore(7, 11)).toBe(64); // 7/11 * 100 = 63.6363... → 64
  });

  it('returns negative integer when delta is negative against positive max', () => {
    // negative deltas mean the measurement was quieter than baseline.
    // We don't clamp here — UI is free to display these as "—" or "0".
    expect(getNormalizedScore(-10, 20)).toBe(-50);
  });
});

describe('getDemoStatus', () => {
  const ID = 'demo-1';
  const sampleScore: Score = { avgDbFs: -30, deltaDb: 12, capturedAt: '2026-05-05T00:00:00.000Z' };

  it("returns 'pending' when no other condition matches", () => {
    expect(getDemoStatus(ID, null, null, {}, [])).toBe('pending');
  });

  it("returns 'measuring' when measuringDemoId matches", () => {
    expect(getDemoStatus(ID, ID, null, {}, [])).toBe('measuring');
  });

  it("returns 'aborted' when abortedDemoId matches and not currently measuring", () => {
    expect(getDemoStatus(ID, null, ID, {}, [])).toBe('aborted');
  });

  it("returns 'measured' when a score exists for the demo", () => {
    expect(getDemoStatus(ID, null, null, { [ID]: sampleScore }, [])).toBe('measured');
  });

  it("returns 'skipped' when demoId is in skippedDemoIds", () => {
    expect(getDemoStatus(ID, null, null, {}, [ID])).toBe('skipped');
  });

  // -- Precedence rules --

  it("'measuring' beats 'aborted' (Retry mid-window must show measuring)", () => {
    expect(getDemoStatus(ID, ID, ID, {}, [])).toBe('measuring');
  });

  it("'aborted' beats 'measured' (redo abort must not show stale prior score)", () => {
    expect(getDemoStatus(ID, null, ID, { [ID]: sampleScore }, [])).toBe('aborted');
  });

  it("'measured' beats 'skipped' (a measured demo is never skipped)", () => {
    expect(getDemoStatus(ID, null, null, { [ID]: sampleScore }, [ID])).toBe('measured');
  });

  it("returns 'pending' for an unrelated demoId", () => {
    expect(getDemoStatus('demo-2', ID, null, { [ID]: sampleScore }, [ID])).toBe('pending');
  });
});
