import { describe, it, expect } from 'vitest';
import { verifyAgcConstraints } from './agcVerify';

describe('verifyAgcConstraints', () => {
  it('returns empty when all three constraints are explicitly false', () => {
    expect(verifyAgcConstraints({
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    })).toEqual([]);
  });

  it('returns empty when all three are undefined (Safari case)', () => {
    // Safari does not return autoGainControl. Must NOT warn.
    expect(verifyAgcConstraints({})).toEqual([]);
  });

  it('returns ["autoGainControl"] when only autoGainControl is true', () => {
    expect(verifyAgcConstraints({
      autoGainControl: true,
      echoCancellation: false,
      noiseSuppression: false,
    })).toEqual(['autoGainControl']);
  });

  it('does NOT warn when constraints are truthy-but-not-true (defensive)', () => {
    // Numbers/strings should not match === true
    // @ts-expect-error — intentionally bad shape
    expect(verifyAgcConstraints({ autoGainControl: 1 })).toEqual([]);
  });

  it('returns all three when all three are true', () => {
    expect(verifyAgcConstraints({
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    })).toEqual(['autoGainControl', 'echoCancellation', 'noiseSuppression']);
  });

  it('returns subset when two of three are true', () => {
    expect(verifyAgcConstraints({
      autoGainControl: false,
      echoCancellation: true,
      noiseSuppression: true,
    })).toEqual(['echoCancellation', 'noiseSuppression']);
  });
});
