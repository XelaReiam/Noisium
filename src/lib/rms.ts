/**
 * Root-mean-square of a Float32Array sample buffer.
 *
 * Used by the AudioEngine rAF loop and by Phase 3 measurement.
 * Lives as a separate pure function so it can be unit-tested without
 * any AudioContext dependency, and reused unchanged by Phase 3.
 *
 * Returns a value in [0, 1] for a clipped Float32 input domain.
 */
export function computeRms(buffer: Float32Array): number {
  const n = buffer.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = buffer[i];
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}
