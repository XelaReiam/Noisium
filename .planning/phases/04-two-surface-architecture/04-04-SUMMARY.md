---
phase: 04-two-surface-architecture
plan: "04"
subsystem: ui
tags: [react, zustand, broadcastchannel, typescript, vitest]

# Dependency graph
requires:
  - phase: 04-01
    provides: ProjectorMessage union, deriveProjectorMessage, getNoisiumChannel, MockBroadcastChannel
  - phase: 04-02
    provides: measurePhase, revealActive, revealWinner, projectorConnected, setMeasurePhase, refreshProjectorHeartbeat
  - phase: 04-03
    provides: ProjectorView rendering all message variants

provides:
  - BroadcastBridge render-null component (host-side channel relay + store subscription)
  - MeasurementOrchestrator extended with setMeasurePhase calls at all stage transitions
  - CalibrateButton extended with direct calibrating/idle channel broadcasts

affects:
  - 04-05  # mounts BroadcastBridge in HostView and adds toolbar UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Render-null component for side-effect-only work (CrossDayCheckEffect pattern)
    - useAppStore.subscribe() for store-to-channel relay without selector re-renders
    - JSON.stringify deduplication for outgoing channel messages
    - Direct channel postMessage for transient UI flows not in store (CalibrateButton)
    - WINDOW_END_HOLD_MS 1200ms deferred completeMeasure for projector synchronization

key-files:
  created:
    - src/components/BroadcastBridge.tsx
    - src/components/BroadcastBridge.test.tsx
    - src/components/MeasurementOrchestrator.test.tsx
    - src/components/CalibrateButton.test.tsx
  modified:
    - src/components/MeasurementOrchestrator.tsx
    - src/components/CalibrateButton.tsx

key-decisions:
  - "BroadcastBridge uses JSON.stringify comparison of last sent message for deduplication — prevents identical consecutive store updates (e.g. projectorConnected toggle) from broadcasting unchanged ProjectorMessage"
  - "CalibrateButton broadcasts calibrating/idle directly to channel rather than through store+BroadcastBridge — calibration is a UI-owned atomic flow with no Zustand transient field needed"
  - "MeasurementOrchestrator defers completeMeasure by 1200ms (WINDOW_END_HOLD_MS) after setMeasurePhase('window-end') — BroadcastBridge sees window-end and broadcasts it; projector's own 1200ms timer runs harmoniously before idle arrives"
  - "window-end also posted directly to channel alongside setMeasurePhase('window-end') — covers the edge case where a projector opens mid-window-end and sends request-state"

patterns-established:
  - "Render-null component pattern: all side effects in single useEffect with full cleanup; return null at end"
  - "Store subscription pattern: useAppStore.subscribe() (not selector) for derive-and-send on any store change"
  - "Direct channel post pattern: UI-owned atomic transitions post directly without round-tripping through store"

requirements-completed: [MEAS-05, PROJ-01, PROJ-02, PROJ-04]

# Metrics
duration: 15min
completed: 2026-05-06
---

# Phase 04 Plan 04: BroadcastBridge + MeasurementOrchestrator + CalibrateButton wiring Summary

**Host-side BroadcastChannel relay wired end-to-end: BroadcastBridge subscribes to store and posts deduplicated ProjectorMessages; MeasurementOrchestrator emits countdown/measuring/window-end phase transitions; CalibrateButton broadcasts calibrating/idle directly to the projector tab**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-06T10:20:00Z
- **Completed:** 2026-05-06T10:24:31Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 2 extended, 2 new test files)

## Accomplishments
- BroadcastBridge render-null component built from scratch — subscribes to store, posts deduplicated ProjectorMessage, handles request-state resync, handles heartbeat-projector → refreshProjectorHeartbeat, sends heartbeat-host every 2s
- MeasurementOrchestrator extended with setMeasurePhase calls at countdown start, measuring start, and window-end; completeMeasure deferred 1200ms to keep projector's "Thank you." timing in sync
- CalibrateButton extended with direct channel posts for calibrating (on click) and idle (on success after confirmation delay and on error immediately)
- 192 total tests passing (up from 189), zero regressions across all 12 prior test files

## Task Commits

Each task was committed atomically:

1. **Task 1: BroadcastBridge render-null component + tests** - `f2869e4` (feat)
2. **Task 2: Wire setMeasurePhase into MeasurementOrchestrator + window-end** - `0685dab` (feat)
3. **Task 3: Wire calibrating/idle broadcasts into CalibrateButton** - `7f9959b` (feat)

## Files Created/Modified
- `src/components/BroadcastBridge.tsx` - Render-null host relay: store subscription, channel listener, heartbeat sender
- `src/components/BroadcastBridge.test.tsx` - 8 tests covering mount, heartbeat, store transitions, dedup, request-state, heartbeat-projector, cleanup
- `src/components/MeasurementOrchestrator.tsx` - Extended with setMeasurePhase calls + window-end hold + getNoisiumChannel import
- `src/components/MeasurementOrchestrator.test.tsx` - 3 tests covering countdown/measuring/window-end phase transitions (new file)
- `src/components/CalibrateButton.tsx` - Extended with direct getNoisiumChannel().postMessage calls for calibrating/idle
- `src/components/CalibrateButton.test.tsx` - 3 tests covering calibrating-on-click, idle-on-success, idle-on-error (new file)

## Decisions Made

**Deduplication approach:** JSON.stringify of last sent ProjectorMessage stored in a ref. On each store update, derive the current message and serialize it — if identical to last sent, skip the postMessage call. Request-state replies always bypass dedup (force=true) since the projector is asking specifically because it missed the prior send.

**Why CalibrateButton broadcasts directly:** Calibration is a local UI flow with no store-tracked transient field. Adding `calibrating: boolean` to AppState solely to let BroadcastBridge derive it would be unnecessary coupling — the button owns the full state machine. The tradeoff (possible stale bridge send during calibration) is acceptable because the 6.5-second calibration cycle involves no other state changes that would trigger a bridge broadcast to a different phase.

**1200ms window-end hold:** After the engine resolves with a score, setMeasurePhase('window-end') is called first so BroadcastBridge broadcasts the window-end message. completeMeasure (which resets measurePhase to 'idle' internally) is deferred by 1200ms via a setTimeout. This aligns with the projector's own 1200ms window-end → idle auto-transition, so the 'idle' message from the bridge arrives just as the projector's local timer is expiring — no premature cutoff.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AbortSignal constructor assertion in test**
- **Found during:** Task 2 (MeasurementOrchestrator tests, test b)
- **Issue:** `expect.any(AbortController.prototype.signal.constructor)` throws "Cannot read private member #signal" — `AbortSignal` is the correct constructor reference
- **Fix:** Changed to `expect.any(AbortSignal)`
- **Files modified:** src/components/MeasurementOrchestrator.test.tsx
- **Verification:** Test b passes after fix
- **Committed in:** `0685dab` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test assertion bug)
**Impact on plan:** Minor test syntax fix. No scope creep, no plan behavior change.

## Issues Encountered
None beyond the AbortSignal constructor fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Host broadcast plumbing is fully wired but BroadcastBridge is not yet mounted in HostView (Plan 05 mounts it alongside CrossDayCheckEffect and MeasurementOrchestrator)
- projectorConnected field is being updated via heartbeat-projector messages (ready for Plan 05 toolbar indicator)
- All MEAS-05, PROJ-01, PROJ-02, PROJ-04 requirements fulfilled at the component level

## Self-Check: PASSED

All created files verified present on disk. All task commits (f2869e4, 0685dab, 7f9959b) verified in git log.

---
*Phase: 04-two-surface-architecture*
*Completed: 2026-05-06*
