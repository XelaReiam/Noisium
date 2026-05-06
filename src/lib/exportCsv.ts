/**
 * Pure-function CSV export utilities for Noisium session results.
 *
 * No React, no Zustand — every function is synchronous and testable in jsdom.
 *
 * Exports:
 *   - CsvRow           — typed row shape
 *   - buildCsvString   — derives and serialises all rows
 *   - buildCsvFilename — derives the download filename from sessionDate
 *   - triggerDownload  — browser side-effect: creates Blob + anchor click
 */

import type { Demo, Score } from '../store/useAppStore';
import { getDemoStatus } from './measurement';

// ============================================================================
// Types
// ============================================================================

export interface CsvRow {
  name: string;
  subject: string;
  deltaDb: string;  // toFixed(2) or '' for unmeasured/skipped/pending
  rank: string;     // '1', '2', etc.; '' for unmeasured/skipped/pending
  status: string;   // 'measured' | 'skipped' | 'pending'
  winner: string;   // 'true' | 'false'
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * RFC 4180 field quoting — always wrap in double-quotes and escape internal
 * double-quotes as "".
 */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// ============================================================================
// Public pure functions
// ============================================================================

/**
 * Build the CsvRow array from store state. Pure — no side-effects.
 */
export function buildCsvRows(
  demos: readonly Demo[],
  scores: Readonly<Record<string, Score>>,
  skippedDemoIds: readonly string[],
): CsvRow[] {
  // 1. Get status for each demo (no active measurement at export time)
  type DemoWithStatus = { demo: Demo; status: string; deltaDb: number | null };
  const withStatus: DemoWithStatus[] = demos.map((demo) => {
    const rawStatus = getDemoStatus(demo.id, null, null, scores as Record<string, Score>, skippedDemoIds);
    // getDemoStatus with nulls can only return 'measured', 'skipped', or 'pending'
    // ('measuring' and 'aborted' are unreachable with null args)
    const status =
      rawStatus === 'measured' || rawStatus === 'skipped'
        ? rawStatus
        : 'pending';
    const deltaDb = status === 'measured' ? scores[demo.id].deltaDb : null;
    return { demo, status, deltaDb };
  });

  // 2. Collect and sort measured demos for rank assignment
  const measured = withStatus
    .filter((d) => d.status === 'measured' && d.deltaDb !== null)
    .slice()
    .sort((a, b) => (b.deltaDb as number) - (a.deltaDb as number));

  // 3. Assign competition ranks (1, 1, 3 for ties)
  const rankMap = new Map<string, number>();
  let prevDelta: number | null = null;
  let prevRank = 0;
  measured.forEach((item, idx) => {
    const delta = item.deltaDb as number;
    const rank = prevDelta !== null && delta === prevDelta ? prevRank : idx + 1;
    rankMap.set(item.demo.id, rank);
    prevDelta = delta;
    prevRank = rank;
  });

  // 4. Build CSV rows preserving original demo order
  return withStatus.map(({ demo, status, deltaDb }) => ({
    name: demo.name,
    subject: demo.subject ?? '',
    deltaDb: deltaDb !== null ? deltaDb.toFixed(2) : '',
    rank: rankMap.has(demo.id) ? String(rankMap.get(demo.id)) : '',
    status,
    winner: rankMap.get(demo.id) === 1 ? 'true' : 'false',
  }));
}

/**
 * Serialise demos + scores into an RFC 4180 CSV string.
 *
 * Header: name,subject,deltaDb,rank,status,winner
 * Line endings: CRLF throughout (including after last row).
 */
export function buildCsvString(
  demos: readonly Demo[],
  scores: Readonly<Record<string, Score>>,
  skippedDemoIds: readonly string[],
): string {
  const header = 'name,subject,deltaDb,rank,status,winner';
  const csvRows = buildCsvRows(demos, scores, skippedDemoIds);

  const dataLines = csvRows.map((row) =>
    [
      csvField(row.name),
      csvField(row.subject),
      row.deltaDb,
      row.rank,
      row.status,
      row.winner,
    ].join(','),
  );

  return [header, ...dataLines].join('\r\n') + '\r\n';
}

/**
 * Derive the download filename from the session date.
 */
export function buildCsvFilename(sessionDate: string | null): string {
  return sessionDate ? `noisium-results-${sessionDate}.csv` : 'noisium-results.csv';
}

/**
 * Trigger a browser file download via a temporary anchor element.
 *
 * Side-effect: creates a Blob URL, appends+clicks an <a> tag, then revokes the
 * URL after 100 ms. Call only in browser environments (not during SSR/tests).
 */
export function triggerDownload(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
