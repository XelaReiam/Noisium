---
phase: 08-transport-abstraction-host-connection-ux
plan: 03
subsystem: ui
tags: [typescript, react, zustand, websocket, vitest, tdd, broadcast-channel]

# Dependency graph
requires:
  - phase: 08-transport-abstraction-host-connection-ux
    plan: 01
    provides: getTransport(mode) factory, resetNoisiumTransport(), MockWebSocket, lanModeEnabled + wsConnectionStatus store fields
affects: [08-04, 09-01]

provides:
  - ProjectorView using getTransport(mode) — no direct BroadcastChannel usage remains
  - WebSocket reconnect with exponential backoff in ProjectorView (1s→2s→4s→capped 30s, reset on open)
  - ProjectorToolbar showing all five wsConnectionStatus labels in LAN mode
  - ProjectorToolbar falling back to projectorConnected heartbeat in broadcast mode

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ProjectorView reads lanModeEnabled from Zustand store to derive TransportMode
    - WS lifecycle attached via cast to _ws property — scheduleReconnect() increments retryCount state to re-run effect
    - retryDelayRef doubles on each retry fire (not on close event), capped at 30000ms
    - STATUS_LABELS Record<wsConnectionStatus, string> maps all five states to display text
    - dotColor ternary: connected=green, waiting/reconnecting=amber, idle/disconnected=red

key-files:
  created: []
  modified:
    - src/components/ProjectorView.tsx
    - src/components/ProjectorView.test.tsx
    - src/components/ProjectorToolbar.tsx
    - src/components/ProjectorToolbar.test.tsx

key-decisions:
  - "ProjectorView accesses WS lifecycle via cast to _ws — no onStatusChange added to transport (scope preserved)"
  - "retryDelay doubles in setTimeout callback, not on close event — ensures doubling tracks actual retry attempts"
  - "Cleanup does NOT call transport.close() — factory owns singleton lifecycle per Plan 01 decision"
  - "retryCount in useEffect deps array causes effect re-run which calls getTransport('websocket') for fresh WS"

patterns-established:
  - "WS reconnect pattern: retryDelayRef + retryTimerRef + retryCount state; retryCount increment triggers effect re-run"
  - "ProjectorView reads lanModeEnabled from useAppStore (lanModeEnabled is persisted — available in projector tab)"

requirements-completed: [CONN-02, CONN-04, TRANS-02]

# Metrics
duration: 8min
completed: 2026-05-06
---

# Phase 8 Plan 03: ProjectorView Transport Migration + ProjectorToolbar Status Labels Summary

**Transport-abstracted ProjectorView with WS exponential-backoff reconnect (1s→30s cap), plus ProjectorToolbar extended to show all five wsConnectionStatus labels in LAN mode while preserving broadcast-mode heartbeat display**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-06T22:12:00Z
- **Completed:** 2026-05-06T22:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Migrated ProjectorView from `getNoisiumChannel()` to `getTransport(mode)` — no direct BroadcastChannel usage remains (TRANS-02)
- Implemented CONN-04: WS exponential backoff in ProjectorView (1s→2s→4s→...capped 30s, resets to 1s on successful open)
- Extended ProjectorToolbar with `STATUS_LABELS` map covering all five wsConnectionStatus values (CONN-02)
- Broadcast mode preserved in both components — projectorConnected heartbeat and BroadcastChannel transport unchanged
- 33 tests passing across both files (19 ProjectorView + 14 ProjectorToolbar)

## Task Commits

1. **Task 1: ProjectorView transport factory + WS reconnect backoff** - `c7a1fbb` (feat)
2. **Task 2: ProjectorToolbar all five wsConnectionStatus labels** - `34c7dfa` (feat)

## Files Created/Modified

- `src/components/ProjectorView.tsx` - Uses getTransport(mode), reads lanModeEnabled, exponential backoff reconnect
- `src/components/ProjectorView.test.tsx` - 19 tests: 13 broadcast mode (TRANS-02) + 6 WS mode (CONN-04)
- `src/components/ProjectorToolbar.tsx` - STATUS_LABELS map, dual-mode display (LAN vs broadcast)
- `src/components/ProjectorToolbar.test.tsx` - 14 tests: 6 broadcast mode + 8 LAN mode (all 5 status values)

## Decisions Made

- ProjectorView accesses the underlying WS via `(transport as unknown as { _ws: WebSocket })._ws` to attach onopen/onclose — no onStatusChange added to WebSocketTransport (keeps Plan 01 contract minimal)
- retryDelay doubles inside the setTimeout callback (not at close event time) — ensures the doubled delay tracks actual retry attempts rather than rapid-close sequences
- Cleanup does NOT call transport.close() — consistent with Plan 01 factory ownership pattern
- retryCount state drives effect re-run which calls getTransport('websocket') — this recreates the WS only after resetNoisiumTransport() nulls the singleton, yielding a fresh connection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed stale privacy test asserting ProjectorView does not import useAppStore**
- **Found during:** Task 1 (writing new test file)
- **Issue:** The existing test `ProjectorView privacy: no useAppStore import` asserted the source file didn't import useAppStore. Plan 03 explicitly requires adding this import (to read lanModeEnabled). The test was a v1.1 guard that became invalid.
- **Fix:** Removed the privacy describe block from the new test file. The requirement note in the plan ("The projector tab IS available in the projector tab. Read lanModeEnabled from useAppStore.") makes this intentional.
- **Files modified:** src/components/ProjectorView.test.tsx
- **Verification:** All tests pass with the import present
- **Committed in:** c7a1fbb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test was guarding against a design now intentionally superseded)
**Impact on plan:** No scope creep. The privacy test existed to prevent accidental store access; Plan 03 makes it intentional and explicit.

## Issues Encountered

The BroadcastBridge tests have 4 failing tests in WS mode — these are Plan 02's TDD RED tests written for BroadcastBridge's wsConnectionStatus integration, which is pending Plan 02's full implementation in its uncommitted working tree. Not regressions from Plan 03.

## Next Phase Readiness

- ProjectorView and ProjectorToolbar are complete for Phase 8
- All three Plan 03 requirements satisfied: CONN-02, CONN-04, TRANS-02
- Wave 2 is complete pending Plan 02 (BroadcastBridge WS mode) completion

## Self-Check: PASSED

All 4 modified files verified present. Both task commits (c7a1fbb, 34c7dfa) confirmed in git log.

---
*Phase: 08-transport-abstraction-host-connection-ux*
*Completed: 2026-05-06*
