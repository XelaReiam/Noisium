/**
 * Pure-function module for Phase 3 measurement math and status derivation.
 *
 * No React, no Web Audio, no Zustand — every function here is deterministic,
 * synchronous, and fully unit-testable in jsdom without any mocks.
 *
 * Imported by:
 *   - src/lib/audioEngine.ts            → dbFsFromRms (per-sample conversion)
 *   - src/store/useAppStore.ts          → computeDelta + Score type
 *   - src/components/DemoCard.tsx       → getNormalizedScore, getDemoStatus
 */

/** Score record stored in useAppStore.scores[demoId]. */
export interface Score {
  /** Average dBFS across the measurement window — never -Infinity (floored). */
  avgDbFs: number;
  /** avgDbFs - calibrationAmbientDb at time of capture. STABLE; not recomputed. */
  deltaDb: number;
  /** ISO timestamp of capture completion. */
  capturedAt: string;
}

/** Derived status for a demo card. NOT stored — computed by getDemoStatus. */
export type DemoStatus =
  | 'pending'
  | 'measuring'
  | 'measured'
  | 'skipped'
  | 'aborted';

/**
 * Convert RMS in [0, 1] to dBFS, with a hard floor to avoid log10(0) = -Infinity.
 *
 * RMS of zero (silent buffer) maps to the floor, not -Infinity. The default
 * floor of -100 dBFS is below any realistic applause and well above
 * Number.NEGATIVE_INFINITY, keeping downstream averaging numerically stable.
 *
 * @param rms     Linear RMS amplitude in [0, 1]
 * @param floor   Lower bound dBFS value (default -100)
 */
export function dbFsFromRms(rms: number, floor: number = -100): number {
  if (rms <= 0) return floor;
  const db = 20 * Math.log10(rms);
  return Math.max(floor, db);
}

/**
 * Delta-dB: how much louder (positive) or quieter (negative) the measurement
 * was vs. the calibration baseline. This is the canonical, stable Noisium score.
 */
export function computeDelta(avgDbFs: number, calibrationAmbientDb: number): number {
  return avgDbFs - calibrationAmbientDb;
}

/**
 * Map a delta-dB to a 0-100 number against the loudest delta observed so far.
 *
 * The loudest demo always shows 100; quieter demos scale proportionally.
 * Returns 0 when maxDeltaDb <= 0 (no positive deltas yet, or division floor).
 * Negative deltas (room is quieter than baseline) produce negative results;
 * the UI may choose to display "—" or clamp at 0.
 */
export function getNormalizedScore(deltaDb: number, maxDeltaDb: number): number {
  if (maxDeltaDb <= 0) return 0;
  return Math.round((deltaDb / maxDeltaDb) * 100);
}

/**
 * Derive the visible status of a demo card from store state.
 *
 * Precedence (highest to lowest):
 *   1. measuring   — `measuringDemoId === demoId`
 *   2. aborted     — `abortedDemoId === demoId` (transient; cleared by clearAbort())
 *   3. measured    — `scores[demoId]` exists
 *   4. skipped     — `skippedDemoIds` includes demoId
 *   5. pending     — none of the above
 *
 * Note on precedence: 'measuring' beats 'aborted' so a Retry that re-enters the
 * measurement window correctly transitions back to 'measuring' even before
 * abortedDemoId is explicitly cleared. 'aborted' beats 'measured' so a redo
 * that aborts mid-window doesn't show the stale prior score badge.
 */
export function getDemoStatus(
  demoId: string,
  measuringDemoId: string | null,
  abortedDemoId: string | null,
  scores: Record<string, Score>,
  skippedDemoIds: readonly string[],
): DemoStatus {
  if (measuringDemoId === demoId) return 'measuring';
  if (abortedDemoId === demoId) return 'aborted';
  if (scores[demoId] !== undefined) return 'measured';
  if (skippedDemoIds.includes(demoId)) return 'skipped';
  return 'pending';
}
