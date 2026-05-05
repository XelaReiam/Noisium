---
phase: 02-audio-pipeline
plan: "03"
subsystem: audio
tags: [zustand, react-hooks, permissions-api, mediadevices, typescript, vitest]

# Dependency graph
requires:
  - phase: 02-audio-pipeline
    plan: "02"
    provides: AudioEngine class with MicPermission type, EngineStatus interface, dispose/markLost/requestPermission API

provides:
  - AppState extended with micPermission (MicPermission), micDeviceId (string|null), audioReady (boolean) + setters
  - partialize invariant preserved (only windowSeconds + sessionDate persisted) — verified by test
  - clearSession() resets all three mic fields in addition to existing Phase 1 fields
  - wirePermissionLoss(engine, getActiveDeviceId) — Safari-graceful permission + devicechange listener helper
  - useAudioEngine() hook — owns single AudioEngine ref per host tab, wires status callback to Zustand
affects:
  - 02-04-level-indicator (imports useAudioEngine; reads engineRef.current for requestPermission and getCurrentLevel)
  - 02-05-device-picker (uses micDeviceId from store; calls engineRef.current.setDevice)
  - Phase 3 measurement engine (consumes same store fields and engine ref)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-export type pattern: MicPermission imported from audioEngine and re-exported from useAppStore — consumers import from one place"
    - "useRef<AudioEngine | null>(null) pattern for stable engine reference across re-renders"
    - "useEffect with empty deps + cleanup dispose() — StrictMode safe via AudioEngine.dispose() idempotency"
    - "wirePermissionLoss returns cleanup array built during async setup — both listeners removed even if permissions.query fails"
    - "getActiveDeviceId getter pattern (not captured value) — sees device switches post-call"

key-files:
  created:
    - src/store/useAppStore.test.ts
    - src/hooks/useAudioEngine.ts
    - src/lib/permissionLoss.ts
    - src/lib/permissionLoss.test.ts
  modified:
    - src/store/useAppStore.ts

key-decisions:
  - "MicPermission re-exported from useAppStore so Plan 02-04 consumers import from one place only"
  - "wirePermissionLoss is async (returns Promise<() => void>) because permissions.query is async — callers must await before listeners are active"
  - "useAudioEngine uses eslint-disable-next-line for empty dep array — Zustand store setters are module-stable; including in deps is a false-positive"
  - "No unit test for useAudioEngine hook — wrapper glue; engine tested in 02-02, store in Task 1; integrated behavior covered by Plan 02-05 manual checkpoint"

patterns-established:
  - "Transient mic state lives in Zustand, engine instance lives in useRef — deliberate decoupling; store knows nothing about engine lifecycle"
  - "clearSession() resets mic fields to idle/null/false without touching the engine — MicPanel's useEffect (Plan 02-04) handles engine teardown by watching micPermission === 'idle'"
  - "wirePermissionLoss: try/catch around permissions.query, cleanups array filled during success path, devicechange always wired"

requirements-completed: []
# NOTE: SET-05 and CAL-03 partially covered:
# SET-05 (real-time level indicator): useAudioEngine provides the engine ref but LevelIndicator
#   UI component not yet built (Plan 02-04). Marked complete when end-to-end wired.
# CAL-03 (AudioContext on user gesture): useAudioEngine hook is ready; requestPermission() called
#   from button click handler wired in Plan 02-04. Marked complete then.

# Metrics
duration: 3min
completed: 2026-05-05
---

# Phase 2 Plan 03: Mic State Integration Summary

**Zustand store extended with transient micPermission/micDeviceId/audioReady fields, useAudioEngine hook owning a StrictMode-safe engine ref, and wirePermissionLoss helper with Safari-graceful feature detection — 54 tests green**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-05T19:53:38Z
- **Completed:** 2026-05-05T19:56:45Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- useAppStore extended in-place: three new transient fields, three setters, clearSession() reset — partialize byte-identical (verified by dedicated test), 46 total tests green after Task 1
- wirePermissionLoss: permissions.query → addEventListener('change') path with graceful Safari fallback; devicechange always wired; async returns cleanup function — 8 tests covering all branches
- useAudioEngine hook: engine created in useEffect (not render), status callback writes to Zustand, cleanup calls dispose (StrictMode double-mount safe via idempotent dispose)

## Store Extension API

```typescript
// New fields in AppState (transient — partialize unchanged)
micPermission: MicPermission;  // default: 'idle'
micDeviceId: string | null;    // default: null
audioReady: boolean;           // default: false

// New setters
setMicPermission(p: MicPermission): void;
setMicDeviceId(id: string | null): void;
setAudioReady(ready: boolean): void;

// clearSession() now also resets mic fields to defaults
```

## wirePermissionLoss API

```typescript
export async function wirePermissionLoss(
  engine: AudioEngine,
  getActiveDeviceId: () => string | null,
): Promise<() => void>
// Returns: cleanup function that removes both listeners
```

## useAudioEngine API

```typescript
export function useAudioEngine(): React.RefObject<AudioEngine | null>
// Returns: stable engineRef — call engineRef.current?.requestPermission() from click handler
// Never call from render — useEffect creates engine, cleanup disposes
```

## Note for Plan 02-04

- Import `useAudioEngine` from `'../hooks/useAudioEngine'`
- Call `await engineRef.current?.requestPermission()` from the "Enable microphone" button click handler
- Do NOT create `new AudioEngine()` or touch `AudioContext` directly — both are owned by the hook
- Read `micPermission` from `useAppStore` to drive conditional rendering
- `clearSession()` resets mic state; watch `micPermission === 'idle'` in a useEffect to call `engineRef.current?.dispose()` (engine teardown on cross-day "Start fresh")

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useAppStore with micPermission, micDeviceId, audioReady** - `19aa831` (feat)
2. **Task 2: permissionLoss helper (permissions.query + devicechange)** - `d9444fb` (feat)
3. **Task 3: useAudioEngine hook — owns the engine ref** - `3ba2b52` (feat)

## Files Created/Modified

- `src/store/useAppStore.ts` - Extended with micPermission, micDeviceId, audioReady + setters + clearSession reset; re-exports MicPermission type
- `src/store/useAppStore.test.ts` - 7 tests: defaults, setters, clearSession reset, partialize invariant
- `src/lib/permissionLoss.ts` - wirePermissionLoss async helper (permissions.query + devicechange)
- `src/lib/permissionLoss.test.ts` - 8 tests: Safari case, devicechange wiring, cleanup, markLost triggers
- `src/hooks/useAudioEngine.ts` - Hook owning AudioEngine ref, wiring status callback to Zustand

## Decisions Made

- **MicPermission re-exported from useAppStore:** Consumers (Plan 02-04 components) only need to import from the store, not from both the store and audioEngine. Matches the store's role as the single source of truth for the audio state shape.
- **wirePermissionLoss is async:** permissions.query is async; the cleanup must capture the PermissionStatus object returned by the query. Returns `Promise<() => void>` — callers await before the permission listener is active.
- **No unit test for useAudioEngine:** The hook is integration glue — engine tested in 02-02, store behavior in Task 1. Testing it would require React Testing Library + jsdom AudioContext mocks for minimal gain. Plan 02-05 manual checkpoint covers integrated behavior.
- **eslint-disable on empty deps in useAudioEngine:** Zustand store setters are stable module-level references; adding them to deps triggers a linter false-positive. Matches the CrossDayCheckEffect pattern from Phase 1.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-04 (LevelIndicator + MicPanel UI) can import `useAudioEngine` and use `engineRef.current?.requestPermission()` from a button click handler
- Plan 02-04 can import `micPermission`, `micDeviceId`, `audioReady` from `useAppStore` to drive conditional rendering
- wirePermissionLoss can be called from Plan 02-04's MicPanel useEffect after permission is granted
- No blockers

## Self-Check: PASSED

- FOUND: src/store/useAppStore.ts
- FOUND: src/store/useAppStore.test.ts
- FOUND: src/hooks/useAudioEngine.ts
- FOUND: src/lib/permissionLoss.ts
- FOUND: src/lib/permissionLoss.test.ts
- FOUND: commit 19aa831 (Task 1 — store extension)
- FOUND: commit d9444fb (Task 2 — permissionLoss)
- FOUND: commit 3ba2b52 (Task 3 — useAudioEngine hook)
- 54/54 tests green
- npm run build exits 0
- partialize contains ONLY windowSeconds + sessionDate (verified by test)
- No onchange= usage in permissionLoss.ts (uses addEventListener)

---
*Phase: 02-audio-pipeline*
*Completed: 2026-05-05*
