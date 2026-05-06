---
phase: 07-export-confetti
plan: 01
subsystem: ui
tags: [csv, export, react, zustand, vitest, rfc4180]

# Dependency graph
requires:
  - phase: 06-per-demo-metadata
    provides: Demo.subject field used in CSV subject column
  - phase: 03-measurement
    provides: getDemoStatus, Score type
  - phase: 04-projector
    provides: canRevealWinner, deriveWinner from projector.ts
provides:
  - buildCsvString pure function with RFC 4180 quoting and competition ranking
  - buildCsvFilename deriving download filename from sessionDate
  - triggerDownload browser utility (Blob + anchor click)
  - DownloadCsvButton self-contained React component wired to Zustand store
  - DownloadCsvButton mounted in HostView reveal section
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() pattern for mock fns referenced inside vi.mock() factories"
    - "Self-contained component reads store directly; no external gate prop needed"
    - "Pure CSV library collocates triggerDownload side-effect for easy testing isolation"

key-files:
  created:
    - src/lib/exportCsv.ts
    - src/lib/exportCsv.test.ts
    - src/components/DownloadCsvButton.tsx
    - src/components/DownloadCsvButton.test.tsx
  modified:
    - src/components/HostView.tsx

key-decisions:
  - "vi.hoisted() used instead of top-level vi.fn() to avoid mock hoisting initialisation error with vi.mock factory"
  - "DownloadCsvButton is self-contained (reads store internally) rather than accepting canReveal as a prop — removes duplication and keeps the gate logic co-located"
  - "csvField() always quotes name and subject fields regardless of content — simpler and RFC 4180 compliant; numeric fields (deltaDb, rank) remain unquoted"

patterns-established:
  - "vi.hoisted + vi.mock async factory: use vi.hoisted for mock fn variables that vi.mock factories reference"

requirements-completed:
  - EXPORT-01

# Metrics
duration: 3min
completed: 2026-05-06
---

# Phase 7 Plan 01: CSV Export Summary

**Browser-native CSV export with RFC 4180 quoting, competition ranking, and a self-gating DownloadCsvButton wired into HostView**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-06T16:18:54Z
- **Completed:** 2026-05-06T16:21:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Pure-function CSV library (`exportCsv.ts`) with full RFC 4180 compliance, competition ranking (1, 1, 3 for ties), and winner flag derivation using `deriveWinner`
- 16 unit tests covering all behaviour: single demo, two demos, ties, skipped, pending, commas, double-quotes, subject field, CRLF endings, filename
- Self-contained `DownloadCsvButton` that renders null until `canRevealWinner` is true, then triggers download on click
- DownloadCsvButton mounted in HostView reveal section adjacent to Reveal winner button

## Task Commits

Each task was committed atomically:

1. **Task 1: Build exportCsv pure-function library with tests** - `02bd25f` (feat)
2. **Task 2: DownloadCsvButton component + HostView wiring** - `a55de6f` (feat)

**Plan metadata:** _(docs commit hash below)_

## Files Created/Modified
- `src/lib/exportCsv.ts` - CsvRow type, buildCsvRows, buildCsvString, buildCsvFilename, triggerDownload
- `src/lib/exportCsv.test.ts` - 16 unit tests for all CSV derivation cases
- `src/components/DownloadCsvButton.tsx` - React component wiring store → CSV export
- `src/components/DownloadCsvButton.test.tsx` - 4 component tests (null render, button visible, click, filename)
- `src/components/HostView.tsx` - DownloadCsvButton imported and mounted in reveal section

## Decisions Made
- `vi.hoisted()` used for the `mockTriggerDownload` variable so it is available before `vi.mock()` hoisting executes — without this, the factory closure captures an uninitialized binding.
- `DownloadCsvButton` is self-contained: it reads `demos`, `scores`, `skippedDemoIds`, and `sessionDate` from the store internally rather than accepting them as props. This keeps canReveal logic co-located and avoids prop drilling.
- All string CSV fields (`name`, `subject`) are always quoted via `csvField()` regardless of content. Numeric-formatted fields (`deltaDb`, `rank`) and enum fields (`status`, `winner`) are written as plain strings — consistent with RFC 4180 and simplest to test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock factory hoisting initialisation error**
- **Found during:** Task 2 (DownloadCsvButton tests — first test run)
- **Issue:** `const mockTriggerDownload = vi.fn()` at module top-level is not yet initialised when `vi.mock()` factory is hoisted by Vitest. The factory referenced the uninitialised binding, causing `ReferenceError: Cannot access 'mockTriggerDownload' before initialization`.
- **Fix:** Replaced top-level `vi.fn()` declaration with `vi.hoisted(() => ({ mockTriggerDownload: vi.fn() }))` pattern, which guarantees the mock fn is created before any hoisting runs.
- **Files modified:** `src/components/DownloadCsvButton.test.tsx`
- **Verification:** All 4 component tests pass after fix.
- **Committed in:** `a55de6f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test setup)
**Impact on plan:** Required to make tests run. No scope change.

## Issues Encountered
None beyond the vi.mock hoisting issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Export functionality complete and tested (EXPORT-01 satisfied)
- Ready for Phase 7 Plan 02 (confetti on reveal if applicable)
- `buildCsvString` + `triggerDownload` exported and available for any future export-format extensions

---
*Phase: 07-export-confetti*
*Completed: 2026-05-06*
