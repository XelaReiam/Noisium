---
phase: 04-two-surface-architecture
plan: 02
subsystem: store
tags: [zustand, typescript, state-management, broadcast-channel, projector]

# Dependency graph
requires:
  - phase: 04-01
    provides: deriveWinner and deriveProjectorMessage pure functions; ProjectorMessageState interface

provides:
  - measurePhase transient field ('idle'|'countdown'|'measuring'|'window-end') on AppState
  - revealActive + revealWinner transient fields on AppState
  - projectorConnected transient field on AppState
  - setMeasurePhase, triggerReveal, resetReveal, setProjectorConnected, refreshProjectorHeartbeat actions
  - abortMeasure and completeMeasure extended to reset measurePhase to idle
  - clearSession extended to reset all Phase 4 transients and cancel stale heartbeat timer

affects:
  - 04-03 (BroadcastBridge reads measurePhase, revealActive, revealWinner, calls refreshProjectorHeartbeat)
  - 04-04 (MeasurementOrchestrator calls setMeasurePhase at countdown/measuring/window-end transitions)
  - 04-05 (HostView calls triggerReveal and resetReveal from toolbar buttons)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level timer ID variable for heartbeat staleness (not stored in Zustand state)
    - deriveWinner imported from lib/projector into store for triggerReveal computation
    - measurePhase reset co-located in abortMeasure/completeMeasure for internal store consistency

key-files:
  created: []
  modified:
    - src/store/useAppStore.ts
    - src/store/useAppStore.test.ts

key-decisions:
  - "Staleness timer (_projectorStaleTimer) lives at module scope, not in Zustand state — storing setTimeout IDs in store is unusual and harder to reason about; module-level gives deterministic clearTimeout() from refreshProjectorHeartbeat and clearSession"
  - "measurePhase resets to idle inside completeMeasure (not in a separate orchestrator action) — keeps store internally consistent so any consumer reading state after completeMeasure sees the correct phase; orchestrator handles the brief window-end display tick separately before calling completeMeasure"
  - "triggerReveal is a no-op if deriveWinner returns null — HostView gating should prevent this path but store is defensive"
  - "partialize unchanged — Phase 4 adds zero persisted keys; confirmed by Test 20 asserting exact key set"

patterns-established:
  - "Module-level side-effect state (timer IDs) colocated with the store file but stored outside Zustand for clarity"
  - "Phase N transient fields reset in clearSession together in a labeled comment block"

requirements-completed: [SHOW-03]

# Metrics
duration: 4min
completed: 2026-05-06
---

# Phase 4 Plan 02: Store Phase 4 Transient Fields Summary

**Zustand store extended with four transient Phase 4 fields (measurePhase, revealActive, revealWinner, projectorConnected) and five actions including a module-scope staleness timer for projector heartbeat — partialize unchanged**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-06T08:00:43Z
- **Completed:** 2026-05-06T08:04:18Z
- **Tasks:** 1 (TDD: red → green)
- **Files modified:** 2

## Accomplishments
- Four Phase 4 transient fields added to AppState interface with correct defaults
- triggerReveal computes winner via deriveWinner (from lib/projector) atomically setting revealActive + revealWinner
- refreshProjectorHeartbeat uses module-level timer that resets on each call and auto-clears after 5 s
- abortMeasure and completeMeasure both now reset measurePhase to idle in the same set() call
- clearSession extended to cancel stale heartbeat timer and reset all four Phase 4 transients
- 18 new tests cover all specified behaviors including fake-timer staleness tests; 164 total passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Phase 4 transient fields, actions, clearSession update** - `be61f66` (feat)

**Plan metadata:** (docs commit to follow)

_Note: TDD task — tests written first (RED: 18 failing), then implementation (GREEN: 48 store tests passing)_

## Files Created/Modified
- `src/store/useAppStore.ts` - Phase 4 fields, types, actions, clearSession + abortMeasure + completeMeasure extensions
- `src/store/useAppStore.test.ts` - 18 new Phase 4 tests appended (defaults, setMeasurePhase, triggerReveal, resetReveal, heartbeat timer, measurePhase consistency, clearSession, partialize invariant)

## Decisions Made
- **Staleness timer at module scope:** `_projectorStaleTimer` is a `number | null` module-level variable. Storing setTimeout IDs in Zustand state is unusual and would add unnecessary serialization surface. Module-level is cleared from both `refreshProjectorHeartbeat` and `clearSession` deterministically.
- **measurePhase reset in completeMeasure:** The store must remain internally consistent — any consumer reading state after `completeMeasure` should see `measurePhase: 'idle'`. The orchestrator (Plan 04) controls the brief `window-end` display tick and calls `completeMeasure` only after that window has elapsed. Co-locating the reset in `completeMeasure` avoids a separate orchestrator action that could be missed.
- **triggerReveal is defensive no-op:** If `deriveWinner` returns null (no measured non-skipped demos), `triggerReveal` returns the existing state unchanged. HostView gating via `canRevealWinner` should prevent this path in normal usage, but the store is defensive.
- **partialize invariant test is explicit:** Test 20 checks `Object.keys(parsed.state).sort()` for exact equality and then individually asserts all four Phase 4 fields absent — belt-and-suspenders approach per plan specification.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BroadcastBridge (Plan 04-03) can read `state.measurePhase`, `state.revealActive`, `state.revealWinner` and call `state.refreshProjectorHeartbeat()` in its message handler
- MeasurementOrchestrator (Plan 04-04) can call `setMeasurePhase('countdown'|'measuring'|'window-end')` at the right transitions
- HostView (Plan 04-05) can call `triggerReveal()` from the "Reveal winner" button and `resetReveal()` from "Reset / New event"
- Phase 4 fields confirmed transient — no persistence regressions (164 tests passing)

---
*Phase: 04-two-surface-architecture*
*Completed: 2026-05-06*
