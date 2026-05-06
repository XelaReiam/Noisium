---
phase: 08-transport-abstraction-host-connection-ux
plan: 01
subsystem: transport
tags: [typescript, zustand, broadcast-channel, websocket, vitest, tdd]

# Dependency graph
requires:
  - phase: 04-projector-view
    provides: AppState shape and broadcastChannel singleton pattern this extends
provides:
  - NoisiumTransport interface with postMessage/addEventListener/removeEventListener/close
  - BroadcastChannelTransport wrapping getNoisiumChannel() singleton
  - WebSocketTransport with JSON parse/stringify, OPEN-guard on send, ws:// URL derivation
  - getTransport(mode) singleton factory with mode-switch close/recreate lifecycle
  - resetNoisiumTransport() test helper
  - MockWebSocket in src/test/setup.ts with _simulateOpen/_simulateMessage/_simulateClose
  - AppState.lanModeEnabled (persisted boolean, default false) + setLanModeEnabled
  - AppState.wsConnectionStatus (transient union, default 'idle') + setWsConnectionStatus
affects: [08-02, 08-03, 08-04, 09-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level singleton factory (getTransport) owns transport lifecycle — components never call close()
    - Transport interface abstracts BroadcastChannel and WebSocket behind identical postMessage/addEventListener API
    - MockWebSocket mirrors MockBroadcastChannel pattern with vi.fn() send and _simulate* helpers
    - wsConnectionStatus is transient (not persisted) — connection state resets on reload
    - lanModeEnabled is persisted — device preference survives page reload and session clear

key-files:
  created:
    - src/lib/transport.ts
    - src/lib/transport.test.ts
  modified:
    - src/test/setup.ts
    - src/store/useAppStore.ts
    - src/store/useAppStore.test.ts

key-decisions:
  - "Transport factory owns singleton lifecycle — components call getTransport(mode) only, never close()"
  - "BroadcastChannelTransport delegates to getNoisiumChannel() to preserve the existing channel singleton"
  - "WebSocketTransport silently drops postMessage when not OPEN (CONNECTING/CLOSING/CLOSED) — no throws"
  - "wsConnectionStatus is transient (excluded from partialize) — fresh 'idle' on each page load"
  - "lanModeEnabled survives clearSession — it is a device preference, not session data"

patterns-established:
  - "Transport mode switching: getTransport(newMode) calls close() on old, creates new — callers are unaware"
  - "WS URL derived as ws(s)://window.location.host — matches CLI that serves from same origin"
  - "MockWebSocket tracking: wrap globalThis.WebSocket in beforeEach to capture instances in array"

requirements-completed: [TRANS-01, TRANS-02, TRANS-03, TRANS-04]

# Metrics
duration: 5min
completed: 2026-05-06
---

# Phase 8 Plan 01: Transport Abstraction + Store Extensions Summary

**Pluggable NoisiumTransport interface with BroadcastChannel and WebSocket adapters behind a mode-switching singleton factory, plus MockWebSocket test infrastructure and two new Zustand store fields (lanModeEnabled, wsConnectionStatus)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-06T20:05:34Z
- **Completed:** 2026-05-06T20:10:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Defined NoisiumTransport interface (4 methods) and TransportMode union — stable contract for all Wave 2 consumers
- Implemented BroadcastChannelTransport (delegates to getNoisiumChannel singleton) and WebSocketTransport (ws:// URL, OPEN guard, JSON parse dispatch)
- getTransport() factory handles singleton lifecycle and mode switching with automatic close of previous transport
- Added MockWebSocket to test/setup.ts following the existing MockBroadcastChannel pattern
- Extended AppState with lanModeEnabled (persisted) and wsConnectionStatus (transient) + their setters
- clearSession explicitly excludes lanModeEnabled (device preference semantics)
- 289 tests passing across all 22 test files — zero regressions

## Task Commits

1. **Task 1: transport.ts + setup.ts MockWebSocket** - `d3fdd42` (feat)
2. **Task 2: useAppStore Phase 8 extensions** - `9da6729` (feat)

## Files Created/Modified

- `src/lib/transport.ts` - NoisiumTransport interface, BroadcastChannelTransport, WebSocketTransport, getTransport factory, resetNoisiumTransport
- `src/lib/transport.test.ts` - 16 unit tests covering all transport behaviors
- `src/test/setup.ts` - MockWebSocket added with _simulateOpen/_simulateMessage/_simulateClose helpers
- `src/store/useAppStore.ts` - lanModeEnabled + wsConnectionStatus fields, actions, partialize update
- `src/store/useAppStore.test.ts` - 14 new Phase 8 tests, existing partialize tests updated

## Decisions Made

- Transport factory owns singleton lifecycle — components call getTransport(mode) only, never close() directly
- WebSocketTransport silently drops postMessage when readyState is not OPEN (no throws) — callers check wsConnectionStatus
- wsConnectionStatus is transient (not in partialize) — connection resets to 'idle' on each page load
- lanModeEnabled survives clearSession — it is a device preference tied to the device, not the show session
- WS URL derived from window.location.host (ws:// for http:, wss:// for https:) — matches CLI serving from same origin

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test suite: `ws.close` not a vi.fn spy**
- **Found during:** Task 1 (transport tests)
- **Issue:** MockWebSocket.close is a regular method, not vi.fn(), so `toHaveBeenCalledOnce()` threw "not a spy"
- **Fix:** Changed test to use `vi.spyOn(ws, 'close')` before calling transport.close()
- **Files modified:** src/lib/transport.test.ts
- **Verification:** Test passes
- **Committed in:** d3fdd42 (Task 1 commit)

**2. [Rule 1 - Bug] Test suite: initial test used `await import()` inside non-async `it()`**
- **Found during:** Task 1 (transport tests — first draft)
- **Issue:** oxc transformer rejected top-level `await` outside async function
- **Fix:** Rewrote tests to use static imports at file top level
- **Files modified:** src/lib/transport.test.ts
- **Verification:** Build and tests pass
- **Committed in:** d3fdd42 (Task 1 commit)

**3. [Rule 1 - Bug] Existing partialize tests expected 5 keys (pre-Phase 8)**
- **Found during:** Task 2 (useAppStore tests)
- **Issue:** Two existing tests asserted exact key set without lanModeEnabled — failed after adding it to partialize
- **Fix:** Updated both assertions to include `'lanModeEnabled'` in expected sorted array
- **Files modified:** src/store/useAppStore.test.ts
- **Verification:** 66 store tests passing
- **Committed in:** 9da6729 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 test correctness fixes)
**Impact on plan:** Minor test corrections only. Implementation matched plan exactly.

## Issues Encountered

None beyond the auto-fixed test issues above.

## Next Phase Readiness

- Transport contract is stable — Wave 2 components (BroadcastBridge, ProjectorView updates, LanModeToggle) can be built
- getTransport('broadcast') is backward-compatible with existing BroadcastBridge usage
- lanModeEnabled and wsConnectionStatus are ready for LanModeToggle and connection status UI

---
*Phase: 08-transport-abstraction-host-connection-ux*
*Completed: 2026-05-06*
