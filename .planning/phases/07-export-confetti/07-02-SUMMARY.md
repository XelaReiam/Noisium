---
phase: 07-export-confetti
plan: 02
subsystem: ui
tags: [react, canvas, animation, confetti, requestAnimationFrame, vitest, testing-library]

# Dependency graph
requires:
  - phase: 07-export-confetti-01
    provides: exportCsv pure function (this plan adds projector confetti, no dependency)
provides:
  - Canvas-based particle confetti component (ConfettiCanvas) fired on displayPhase='name'
  - ProjectorReveal wired with confetti activation via active prop
  - Structural tests for both ConfettiCanvas and ProjectorReveal
affects: [projector-reveal, winner-display, projector-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Props-only confetti component: no store access, all state from active boolean prop"
    - "jsdom canvas guard: getContext('2d') returns null in tests — useEffect returns early without crashing"
    - "rAF loop with self-contained cleanup: cancelAnimationFrame on useEffect teardown prevents orphan loops"
    - "z-index stacking via position:relative on container + absolute canvas (z:0) + relative content wrapper (z:1)"

key-files:
  created:
    - src/components/ConfettiCanvas.tsx
    - src/components/ConfettiCanvas.test.tsx
    - src/components/ProjectorReveal.test.tsx
  modified:
    - src/components/ProjectorReveal.tsx

key-decisions:
  - "Hand-rolled Canvas + requestAnimationFrame — no npm confetti library; avoids bundle bloat and main-thread blocking risk flagged in STATE.md blockers"
  - "active=false returns null immediately — no canvas in DOM when buildup phase is active"
  - "ConfettiCanvas is first child in ProjectorReveal (z-index 0) with content wrapper at z-index 1 — winner text always readable on top"
  - "Tests are structural only (no pixel assertions) because jsdom does not implement Canvas 2D getContext()"

patterns-established:
  - "Canvas components: always guard with if (!ctx) return after getContext('2d') for jsdom compatibility"
  - "rAF tests: mock requestAnimationFrame and cancelAnimationFrame in beforeEach/afterEach to prevent jsdom errors"

requirements-completed: [PROJ-05]

# Metrics
duration: 2min
completed: 2026-05-06
---

# Phase 7 Plan 02: Confetti Canvas Summary

**Hand-rolled canvas confetti animation (120 particles, gravity + RAF loop) wired into ProjectorReveal, activating automatically when displayPhase transitions to 'name'**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-06T16:18:52Z
- **Completed:** 2026-05-06T16:21:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ConfettiCanvas component: 120 particles with gravity, rotation, and 6-color palette; RAF loop with self-contained cleanup; returns null when inactive
- ProjectorReveal wired with ConfettiCanvas as first child (z-index 0), content wrapper at z-index 1 — winner text always on top
- Structural tests for both components: canvas present/absent based on active prop; no useAppStore import invariant verified
- Full test suite green (254 tests), zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: ConfettiCanvas component with structural tests** - `d0efd68` (feat)
2. **Task 2: Wire ConfettiCanvas into ProjectorReveal + update tests** - `59e1f7f` (feat)

**Plan metadata:** *(pending docs commit)*

## Files Created/Modified
- `src/components/ConfettiCanvas.tsx` - Canvas-based particle confetti, active prop controls rendering and RAF loop
- `src/components/ConfettiCanvas.test.tsx` - Structural tests: canvas present/absent, style checks, no-store-provider test
- `src/components/ProjectorReveal.tsx` - Added ConfettiCanvas import, position:relative on container, z-index layering
- `src/components/ProjectorReveal.test.tsx` - Tests for confetti activation by displayPhase, winner text rendering

## Decisions Made
- Hand-rolled Canvas + requestAnimationFrame rather than a library — avoids bundle bloat and resolves the main-thread concern from STATE.md blockers
- `active=false` causes early `return null` before canvas renders — clean DOM, no RAF running when not needed
- jsdom guard: `if (!ctx) return` inside useEffect prevents errors in test environment where canvas API is unimplemented
- Tests mock requestAnimationFrame/cancelAnimationFrame to prevent jsdom errors without skipping behavior tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — jsdom's missing Canvas 2D implementation was already anticipated by the plan's jsdom guard instruction and structural-only test approach.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PROJ-05 complete: confetti fires on projector reveal, winner text readable on top, cleanup on unmount
- Phase 7 complete: both export (07-01) and confetti (07-02) delivered
- Manual smoke test remains: open projector tab, reveal winner, verify confetti animation with readable winner text

## Self-Check: PASSED

- FOUND: src/components/ConfettiCanvas.tsx
- FOUND: src/components/ConfettiCanvas.test.tsx
- FOUND: src/components/ProjectorReveal.test.tsx
- FOUND: .planning/phases/07-export-confetti/07-02-SUMMARY.md
- FOUND commit: d0efd68 (feat(07-02): add ConfettiCanvas component with structural tests)
- FOUND commit: 59e1f7f (feat(07-02): wire ConfettiCanvas into ProjectorReveal with tests)

---
*Phase: 07-export-confetti*
*Completed: 2026-05-06*
