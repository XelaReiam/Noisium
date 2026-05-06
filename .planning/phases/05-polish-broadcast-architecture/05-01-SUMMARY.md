---
phase: 05-polish-broadcast-architecture
plan: "01"
subsystem: broadcast-architecture
tags:
  - store
  - projector
  - broadcast
  - tech-debt
  - refactor
dependency_graph:
  requires:
    - 04-04 (BroadcastBridge, deriveProjectorMessage, getNoisiumChannel)
    - 04-01 (ProjectorMessage union including calibrating variant)
  provides:
    - Unified single broadcast path through BroadcastBridge for all ProjectorMessage variants
    - CalibrateButton enabled on micPermission alone (TD-2 closed)
    - measurePhase type includes 'calibrating' (store + projector.ts)
  affects:
    - src/store/useAppStore.ts
    - src/lib/projector.ts
    - src/components/CalibrateButton.tsx
    - src/components/MeasurementOrchestrator.tsx
    - src/components/CalibrateButton.test.tsx
    - src/lib/projector.test.ts
    - src/components/BroadcastBridge.test.tsx
tech_stack:
  added: []
  patterns:
    - Store-write-then-derive pattern replaces imperative postMessage for all calibration transitions
    - TDD (RED → GREEN) for projector.ts branch and component behavior changes
key_files:
  created: []
  modified:
    - src/store/useAppStore.ts
    - src/lib/projector.ts
    - src/components/CalibrateButton.tsx
    - src/components/MeasurementOrchestrator.tsx
    - src/components/CalibrateButton.test.tsx
    - src/lib/projector.test.ts
    - src/components/BroadcastBridge.test.tsx
decisions:
  - "measurePhase 'calibrating' is transient (not persisted) — calibration must re-run in-room each session; partialize unchanged"
  - "Calibrating branch inserted at Priority 2 (between reveal and measuringDemoId) so calibration always wins over idle regardless of measuringDemoId"
  - "CalibrateButton disabled condition reduced to: noPermission || measurementRunning || inFlight — no demos.length check (TD-2 closed)"
  - "MeasurementOrchestrator window-end direct post removed; setMeasurePhase('window-end') alone is sufficient since BroadcastBridge subscribes to store"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 3
  files_modified: 7
requirements_closed:
  - CAL-01
  - MEAS-05
  - SHOW-03
---

# Phase 5 Plan 01: Polish Broadcast Architecture Summary

**One-liner:** Unified all BroadcastChannel posts through BroadcastBridge by widening measurePhase to include 'calibrating' and replacing three direct postMessage calls with store writes; removed the spurious demos.length gate from CalibrateButton (TD-2 + TD-3 closed).

## What Was Built

### Task 1: Widen measurePhase + extend deriveProjectorMessage

- Added `'calibrating'` to `measurePhase` union in `AppState` (line 50) and `setMeasurePhase` signature (line 91) in `useAppStore.ts`
- Widened `ProjectorMessageState.measurePhase` in `projector.ts` to match
- Inserted Priority 2 branch in `deriveProjectorMessage`: `if (state.measurePhase === 'calibrating') return { phase: 'calibrating' }` — fires between reveal-check and measuringDemoId-check, independent of measuringDemoId
- Updated JSDoc: calibrating is now state-derived, not imperative
- Added two new calibrating-branch tests to `projector.test.ts`
- Added `'calibrating'` to host-invariant sweep array (measurePhases)

### Task 2: Refactor CalibrateButton and MeasurementOrchestrator

- Removed `getNoisiumChannel` import from both components
- **CalibrateButton:** Replaced `postMessage({ phase: 'calibrating' })` → `setMeasurePhase('calibrating')`; replaced both `postMessage({ phase: 'idle' })` calls (success timer + catch block) → `setMeasurePhase('idle')`; removed `demos` selector, `noDemos` constant, and `noDemos` from disabled condition + helper text
- **MeasurementOrchestrator:** Removed `demoNameForWindowEnd` variable and the `getNoisiumChannel().postMessage({ phase: 'window-end', ... })` call; `setMeasurePhase('window-end')` alone is sufficient as BroadcastBridge subscribes and derives automatically

### Task 3: Update tests

- **CalibrateButton.test.tsx:** Full rewrite — renamed describe block to `'CalibrateButton — store-driven broadcast (Phase 5)'`; removed `addDemo('TestDemo')` and `resetNoisiumChannel()` calls; added zero-demo enabled test; updated tests (a)(b)(c) to assert `useAppStore.getState().measurePhase` instead of `ch.postMessage`
- **BroadcastBridge.test.tsx:** Added new test verifying `setMeasurePhase('calibrating')` causes BroadcastBridge to broadcast `{ phase: 'calibrating' }` on the channel

## Commits

| Hash | Message |
|------|---------|
| 4afbce6 | feat(05-01): widen measurePhase to include calibrating; extend deriveProjectorMessage |
| 236e532 | feat(05-01): refactor CalibrateButton and MeasurementOrchestrator to use store writes |
| 3caed6a | test(05-01): rewrite CalibrateButton tests + add BroadcastBridge calibrating test |

## Verification Results

- `npm test`: 201 tests passing (14 test files)
- `npx tsc --noEmit`: exits 0
- `grep getNoisiumChannel\|postMessage CalibrateButton.tsx MeasurementOrchestrator.tsx`: no matches
- `grep calibrating useAppStore.ts`: matches widened type union (lines 50, 91)
- `grep calibrating projector.ts`: matches interface + deriveProjectorMessage branch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `toBeDisabled()` matcher unavailable — replaced with `.disabled` DOM property**
- **Found during:** Task 3
- **Issue:** `@testing-library/jest-dom` is not set up in this project's test setup; `toBeDisabled()` is a jest-dom custom matcher that throws "Invalid Chai property"
- **Fix:** Replaced `expect(btn).not.toBeDisabled()` with `expect((btn as HTMLButtonElement).disabled).toBe(false)` — equivalent assertion using native DOM property
- **Files modified:** `src/components/CalibrateButton.test.tsx`
- **Commit:** 3caed6a (included in Task 3 commit)

## Self-Check: PASSED
