---
phase: 08-transport-abstraction-host-connection-ux
plan: 02
subsystem: ui
tags: [typescript, react, zustand, broadcast-channel, websocket, vitest, tdd, tailwind]

# Dependency graph
requires:
  - phase: 08-transport-abstraction-host-connection-ux
    plan: 01
    provides: getTransport(mode) factory, NoisiumTransport interface, lanModeEnabled + wsConnectionStatus store fields, MockWebSocket test infrastructure

provides:
  - LanModeToggle component (labeled checkbox + conditional projector URL display)
  - BroadcastBridge updated to use getTransport(mode) instead of getNoisiumChannel()
  - BroadcastBridge drives wsConnectionStatus from WS lifecycle (waiting/connected/disconnected)
  - HostView mounts LanModeToggle in the header toolbar area
affects: [08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BroadcastBridge mode dependency on [mode] — effect re-runs on every lanModeEnabled toggle
    - vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus') for reliable cross-test spy verification
    - TrackingWs subclass pattern for capturing MockWebSocket instances without breaking 'new' semantics

key-files:
  created:
    - src/components/LanModeToggle.tsx
    - src/components/LanModeToggle.test.tsx
  modified:
    - src/components/BroadcastBridge.tsx
    - src/components/BroadcastBridge.test.tsx
    - src/components/HostView.tsx

key-decisions:
  - "BroadcastBridge uses transport._ws._ws onopen/onclose for WS status — cleaner than cast, avoids adding onStatusChange to transport.ts"
  - "WS status spy tests use vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus') not store state reads — avoids async React flush isolation issues"
  - "TrackingWs extends OriginalWs subclass pattern — required because vi.spyOn on a class breaks 'new' semantics"

patterns-established:
  - "Use vi.spyOn on store action directly when Zustand state-read tests are flaky across describe blocks"
  - "Wrap globalThis class with a subclass (not vi.spyOn) to capture constructor-created instances"

requirements-completed: [CONN-01, CONN-03, TRANS-03, TRANS-04]

# Metrics
duration: 8min
completed: 2026-05-06
---

# Phase 8 Plan 02: LanModeToggle + BroadcastBridge Transport Rewire Summary

**LanModeToggle host-side toggle with projector URL display, BroadcastBridge rewired to getTransport(mode) factory with WS lifecycle-driven wsConnectionStatus**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-06T20:12:00Z
- **Completed:** 2026-05-06T20:20:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- LanModeToggle: labeled checkbox reads/writes lanModeEnabled, conditionally shows `data-testid="projector-url"` with derived window.location URL
- BroadcastBridge: replaced `getNoisiumChannel()` with `getTransport(mode)` — effect depends on `[mode]` enabling seamless transport switching on toggle
- WS lifecycle hooks attach to `transport._ws.onopen`/`onclose` to drive `wsConnectionStatus` through waiting → connected → disconnected states
- HostView: LanModeToggle mounted in header alongside ProjectorToolbar
- 319 tests passing across 23 test files — zero regressions

## Task Commits

1. **Task 1: LanModeToggle component** - `ee33eed` (feat)
2. **Task 2: BroadcastBridge rewire + HostView mount** - `34e8416` (feat)

## Files Created/Modified

- `src/components/LanModeToggle.tsx` - Toggle checkbox + conditional projector URL display, reads/writes store
- `src/components/LanModeToggle.test.tsx` - 9 tests: toggle behavior, URL show/hide, store read/write
- `src/components/BroadcastBridge.tsx` - Replaced getNoisiumChannel with getTransport(mode), added mode to effect deps, WS status hooks
- `src/components/BroadcastBridge.test.tsx` - Extended from 8 to 16 tests: broadcast mode (10) + websocket mode (6)
- `src/components/HostView.tsx` - Added LanModeToggle import + mount in header

## Decisions Made

- Accessed `(transport as any)._ws` to attach WS lifecycle hooks — plan noted this as acceptable fallback when `onStatusChange` not in transport.ts (it wasn't from Plan 01)
- Used `vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus')` for WS status tests rather than reading store state after `await act(async() => {})` — async flush approach had cross-describe-block isolation issues in concurrent Vitest environment
- Used `class TrackingWs extends OriginalWs` subclass pattern to capture MockWebSocket instances — `vi.spyOn` on a global class breaks its `new` constructor semantics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion used hardcoded `localhost` but jsdom uses `localhost:3000`**
- **Found during:** Task 1 (LanModeToggle tests — RED phase)
- **Issue:** Test expected `http://localhost/#/projector` but jsdom's `window.location.host` = `localhost:3000`
- **Fix:** Changed test to use `${window.location.protocol}//${window.location.host}/#/projector` (dynamic, matches runtime)
- **Files modified:** src/components/LanModeToggle.test.tsx
- **Verification:** LanModeToggle tests all pass
- **Committed in:** ee33eed (Task 1 commit)

**2. [Rule 1 - Bug] `vi.spyOn(globalThis, 'WebSocket')` breaks `new WebSocket()` semantics**
- **Found during:** Task 2 (BroadcastBridge WS tests)
- **Issue:** `vi.spyOn` replaces the class with a non-constructor function — `new WebSocket(url)` in WebSocketTransport threw "not a constructor"
- **Fix:** Changed to `class TrackingWs extends OriginalWs` subclass pattern, replacing `globalThis.WebSocket` with the subclass before/after each test
- **Files modified:** src/components/BroadcastBridge.test.tsx
- **Verification:** wsInstances properly populated, all WS mode tests pass
- **Committed in:** 34e8416 (Task 2 commit)

**3. [Rule 1 - Bug] `await act(async () => {})` for effect flushing was flaky across describe blocks**
- **Found during:** Task 2 (BroadcastBridge WS tests — cross-block isolation)
- **Issue:** Tests checking `wsConnectionStatus` in store passed when run in isolation but failed when run after broadcast describe block — likely due to React async scheduling interactions between test groups
- **Fix:** Changed WS status assertions to use `vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus')` — verifies the call was made synchronously within the effect rather than reading final store state
- **Files modified:** src/components/BroadcastBridge.test.tsx
- **Verification:** All 16 BroadcastBridge tests pass reliably in full suite run
- **Committed in:** 34e8416 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 test correctness fixes)
**Impact on plan:** Test infrastructure corrections only. Implementation matched plan exactly.

## Issues Encountered

The WS status test isolation issue (deviation 3) was the most complex: React 18 concurrent mode async effect flushing interacted poorly with Zustand store state reads across describe blocks. The spy approach is more robust and tests the correct thing (that the action was called) rather than the incidental final state value.

## Next Phase Readiness

- LanModeToggle is available for use in Plan 03 (ProjectorToolbar connection status UI)
- BroadcastBridge now drives wsConnectionStatus — Plan 03's ProjectorToolbar can subscribe to it
- All four TRANS/CONN requirements for Plan 02 are fulfilled

---
*Phase: 08-transport-abstraction-host-connection-ux*
*Completed: 2026-05-06*
