---
phase: 06-per-demo-metadata
plan: 02
subsystem: ui
tags: [react, typescript, testing-library, vitest, zustand, tdd]

# Dependency graph
requires:
  - phase: 06-per-demo-metadata/06-01
    provides: Demo.subject/logoUrl fields, updateDemoMeta action, extended ProjectorMessage measuring variant

provides:
  - DemoCard with subject text input + logo file input + logo preview img + size error
  - ProjectorSuspense with optional demoSubject/demoLogoUrl props + conditional rendering
  - ProjectorView wiring: passes demoSubject/demoLogoUrl from 'measuring' message into ProjectorSuspense

affects:
  - Host UI — every DemoCard now shows subject input and logo upload row
  - Projector suspense screen — shows demo subject and logo during measurement window

# Tech tracking
tech-stack:
  added: []
  patterns:
    - vi.stubGlobal for FileReader mock — class-based constructor mock for synchronous FileReader.onload invocation in tests
    - vi.stubGlobal for requestAnimationFrame — no-op mock returning fake ID to prevent infinite recursion from rAF-loop components

key-files:
  created:
    - src/components/DemoCard.test.tsx
    - src/components/ProjectorSuspense.test.tsx
  modified:
    - src/components/DemoCard.tsx
    - src/components/ProjectorSuspense.tsx
    - src/components/ProjectorView.tsx

key-decisions:
  - "FileReader mock uses a class (not vi.fn()) as constructor — vi.fn() cannot be used with `new` in vitest; class-based mock calls onload synchronously inside readAsDataURL"
  - "requestAnimationFrame mock returns fake ID without calling callback — ProjectorSuspense rAF loop re-queues when p < 1, so synchronous callback execution would cause infinite recursion"
  - "Metadata row inherits baseDisabled opacity/pointer-events from outer wrapper — no separate disabled prop needed on the row inputs"

# Metrics
duration: 4min
completed: 2026-05-06
---

# Phase 06 Plan 02: UI Wiring for Per-Demo Metadata Summary

**DemoCard extended with subject input + logo upload (FileReader, 200 KB cap); ProjectorSuspense renders optional subject text and logo img; ProjectorView threads new props from 'measuring' message**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-06T17:44:00Z
- **Completed:** 2026-05-06T17:48:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 existing + 2 new test files)

## Accomplishments

- `DemoCard.tsx` extended: `updateDemoMeta` selector added, `logoError` local state, `handleSubjectBlur` (trims, sends `undefined` for empty), `handleLogoChange` (200 KB gate → FileReader → `updateDemoMeta`); metadata row renders subject input, Logo file input, logo preview `img`, and size error span
- `DemoCard.test.tsx` created: 10 TDD tests covering all behaviors (subject input defaultValue, blur trimming/undefined, file input accept, img preview, absent img, oversized error, valid FileReader invocation, disabled class)
- `ProjectorSuspense.tsx` extended: `demoSubject?` and `demoLogoUrl?` props added to `Props` interface; logo `img` conditionally rendered above demoName; subject `p` conditionally rendered below demoName; progress bar markup unchanged
- `ProjectorSuspense.test.tsx` created: 5 TDD tests (subject renders, logo renders, backward-compat no-props, absent logo no img, progress bar always present)
- `ProjectorView.tsx`: `measuring` case uses block scope `{ }` to allow `const` destructuring; `demoSubject` and `demoLogoUrl` passed from message into `ProjectorSuspense`
- All 226 tests pass (was 211 before 06-01, 221 after Task 1 of this plan, 226 after Task 2); `tsc --noEmit` exits 0

## Task Commits

1. **Task 1: Extend DemoCard with subject input and logo upload** — `96fecf1` (feat)
2. **Task 2: Extend ProjectorSuspense props and wire through ProjectorView** — `8ee9a40` (feat)

_Note: Both tasks followed TDD — tests written RED first, implementation brought them GREEN._

## Files Created/Modified

- `src/components/DemoCard.tsx` — Added updateDemoMeta + logoError state + handlers + metadata JSX row
- `src/components/DemoCard.test.tsx` — NEW: 10 tests for subject/logo UI
- `src/components/ProjectorSuspense.tsx` — Extended Props interface + conditional logo/subject rendering
- `src/components/ProjectorSuspense.test.tsx` — NEW: 5 tests for subject/logo display and backward compat
- `src/components/ProjectorView.tsx` — Block-scoped measuring case; passes demoSubject/demoLogoUrl to ProjectorSuspense

## Decisions Made

- `vi.fn()` cannot be used with `new` in vitest — replaced FileReader mock with a real class implementing the same interface, calling `onload` synchronously inside `readAsDataURL`
- `requestAnimationFrame` mock returns fake ID without invoking the callback — necessary because ProjectorSuspense's rAF tick re-queues itself while `p < 1`, causing infinite recursion if the callback runs synchronously
- Metadata row inherits `opacity-50 pointer-events-none` from the outer wrapper div (applied when `baseDisabled` is true) — no separate disabled logic needed on the individual inputs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FileReader mock required class not vi.fn()**
- **Found during:** Task 1 (RED→GREEN)
- **Issue:** `vi.fn()` cannot be called with `new` in vitest; caused "not a constructor" error
- **Fix:** Replaced `vi.fn(() => mockReaderInstance)` with a proper `class MockFileReader` that calls `onload` synchronously inside `readAsDataURL`
- **Files modified:** `src/components/DemoCard.test.tsx`
- **Commit:** `96fecf1`

**2. [Rule 1 - Bug] requestAnimationFrame mock needed no-op to prevent stack overflow**
- **Found during:** Task 2 (RED phase investigation)
- **Issue:** Calling the rAF callback synchronously caused infinite recursion since ProjectorSuspense re-queues when `p < 1`
- **Fix:** Changed rAF mock to `vi.fn().mockReturnValue(1)` (no callback invocation)
- **Files modified:** `src/components/ProjectorSuspense.test.tsx`
- **Commit:** `8ee9a40`

## Issues Encountered

None blocking. Two test infrastructure issues auto-fixed per deviation Rule 1.

## User Setup Required

None.

## Next Phase Readiness

- META-01 and META-02 UI surfaces are complete: subject input wired to store, logo uploaded via FileReader to data URL
- ProjectorSuspense backward-compatible: existing tests (and all ProjectorView tests) pass unchanged
- META-03 fully satisfied: projector suspense screen renders demo subject and logo when present
- Phase 7 (Export + Confetti) can proceed independently
