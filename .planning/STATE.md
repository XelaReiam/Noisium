---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-01-PLAN.md
last_updated: "2026-05-06T10:00:00.000Z"
last_activity: 2026-05-06 — Phase 4 Plan 1 complete (MockBroadcastChannel + projector pure functions, 143 tests passing)
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 18
  completed_plans: 15
  percent: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** The host can run a multi-demo applause contest end-to-end on a single laptop, with each demo's score captured fairly and the winner revealed with confidence.
**Current focus:** Phase 4 — Two-Surface Architecture (Phase 3 complete 2026-05-05)

## Current Position

Phase: 4 of 4 (Two-Surface Architecture) — IN PROGRESS
Plan: 1 of 5 in current phase (1 done, 4 remaining)
Status: Plan 04-01 complete — MockBroadcastChannel jsdom polyfill + ProjectorMessage union + pure functions, 143 tests passing
Last activity: 2026-05-06 — Phase 4 Plan 1 complete (MockBroadcastChannel + projector pure functions, 143 tests passing)

Progress: [########░░] 75%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-scaffold-state-layer | 3 | ~8min | ~3min |
| 02-audio-pipeline | 3 | ~10min | ~3min |

**Recent Trend:**
- Last 5 plans: fast
- Trend: stable

*Updated after each plan completion*
| Phase 01-scaffold-state-layer P01 | 4 | 2 tasks | 14 files |
| Phase 01-scaffold-state-layer P02 | 2min | 2 tasks | 3 files |
| Phase 02-audio-pipeline P01 | 3min | 3 tasks | 10 files |
| Phase 02-audio-pipeline P02 | 4min | 2 tasks | 2 files |
| Phase 02-audio-pipeline P03 | 3min | 3 tasks | 5 files |
| Phase 02-audio-pipeline P04 | 2min | 2 tasks | 8 files |
| Phase 03-calibration-measurement-show-control P01 | 2min | 3 tasks | 3 files |
| Phase 03-calibration-measurement-show-control P02 | 4 | 2 tasks | 2 files |
| Phase 03-calibration-measurement-show-control P03 | 3min | 2 tasks | 3 files |
| Phase 03-calibration-measurement-show-control P04 | 2min | 3 tasks | 3 files |
| Phase 03-calibration-measurement-show-control P05 | 3min | 4 tasks | 5 files |
| Phase 03-calibration-measurement-show-control P06 | ~2h | 3 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 4-phase structure derived from requirements — audio pipeline before any UI, calibration+measurement in same phase, BroadcastChannel split after store shape is locked
- Architecture: AudioContext held in React ref (not state), getFloatTimeDomainData only, wall-clock window boundaries via performance.now()
- Deployment: GitHub Pages with HashRouter; base `/noisium/` in vite.config.ts
- [Phase 01-scaffold-state-layer]: Repo made public to enable GitHub Pages on free plan; scaffold via temp-dir copy due to non-pipeable interactive prompts; named export App for plan-03 SecureContextBlocker wrapping; Tailwind v4 via @tailwindcss/vite only (no config files)
- [Phase 01-scaffold-state-layer]: No onRehydrateStorage: state setter calls inside it are overwritten by Zustand post-rehydrate merge (bugs #1527/#1688/#1691); cross-day logic goes in plan 01-03 useEffect
- [Phase 01-scaffold-state-layer]: partialize lists only windowSeconds + sessionDate explicitly — transients and action functions excluded to prevent silent null serialization
- [Phase 01-scaffold-state-layer]: Storage probe at main.tsx module level before createRoot: avoids StrictMode double-render banner flicker
- [Phase 01-scaffold-state-layer P03]: SecureContextBlocker wraps RouterProvider (not vice versa) so HTTP check fires before any routing or store reads
- [Phase 01-scaffold-state-layer P03]: createHashRouter has no basename — Vite base and HashRouter basename are orthogonal; combining them double-encodes the path prefix
- [Phase 01-scaffold-state-layer P03]: CrossDayCheckEffect is a render-null component with useEffect — keeps cross-day side-effect isolated from presentational HostView
- [Phase 01-scaffold-state-layer P03]: Start fresh is default-focused in CrossDayModal so Enter key always triggers the safe (clear) action on first render
- [Phase 02-audio-pipeline P01]: Vitest 4.x installed (4.1.5, not 3.x) — exits code 1 with no test files; added --passWithNoTests to test script
- [Phase 02-audio-pipeline P01]: globalThis used instead of global in setup.ts — TS DOM lib does not declare 'global' as a name; globalThis is cross-env
- [Phase 02-audio-pipeline P01]: verifyAgcConstraints uses === true strictly — Safari omits autoGainControl from track.getSettings(); truthy check causes false positive
- [Phase 02-audio-pipeline P01]: detectBrowser uses userAgentData presence as primary Chromium signal — Firefox and Safari do not implement it (confirmed 2026)
- [Phase 02-audio-pipeline]: erasableSyntaxOnly disallows constructor parameter properties — used explicit field declaration + this.x = x pattern
- [Phase 02-audio-pipeline]: MediaTrackSettings.echoCancellation is string|boolean|undefined — extract boolean-only fields before passing to verifyAgcConstraints
- [Phase 02-audio-pipeline]: Float32Array<ArrayBuffer> explicit annotation required in TS 5.7+ — new Float32Array(size) infers Float32Array<ArrayBufferLike>
- [Phase 02-audio-pipeline P03]: MicPermission re-exported from useAppStore — consumers import from one place, not both store and audioEngine
- [Phase 02-audio-pipeline P03]: wirePermissionLoss is async (returns Promise<() => void>) — permissions.query is async; cleanup captures PermissionStatus object
- [Phase 02-audio-pipeline P03]: useAudioEngine uses empty dep array with eslint-disable — Zustand setters are module-stable; including them in deps is a false-positive
- [Phase 02-audio-pipeline P03]: clearSession() resets mic fields without touching engine — MicPanel useEffect (Plan 02-04) handles engine teardown by watching micPermission === 'idle'
- [Phase 02-audio-pipeline]: window.__noisiumDisposeEngine bridge for CrossDayModal engine teardown — avoids coupling Zustand to runtime AudioEngine instances
- [Phase 02-audio-pipeline]: getLevelRef.current pattern for stable rAF getter — prevents LevelIndicator rAF loop restart on every parent re-render
- [Phase 02-audio-pipeline]: All mic-panel leaf components are props-only (no store/engine imports) — orchestration lives entirely in MicPanel
- [Phase 03-calibration-measurement-show-control]: measurement.ts centralizes all Phase 3 math as pure functions — no React, no Web Audio, no Zustand; fully testable in jsdom; single source of truth for dbFsFromRms, computeDelta, getNormalizedScore, getDemoStatus
- [Phase 03-calibration-measurement-show-control]: partialize-invariant test updated in Wave 0 (03-01) before store extension (03-02) — intentionally RED test pre-declares Phase 3 storage contract; as-any cast is pragmatic bridge removed by 03-02
- [Phase 03-calibration-measurement-show-control]: moveDemo uses up/down direction enum rather than reorderDemos full-array swap — fits planned arrow-button UI in 03-04 without requiring UI to reconstruct full reordered array
- [Phase 03-calibration-measurement-show-control]: confirmRedo does NOT call startMeasure — calling component (03-05) owns sequencing; abortReasonToMessage at module scope is single source of truth for abort copy; completeMeasure removes demo from skippedDemoIds (measured demo supersedes skip)
- [Phase 03-calibration-measurement-show-control]: setInterval(33ms) for measurement sampling (not rAF) — avoids frame contention with existing VU loop; addEventListener('statechange') not onstatechange= — additive, preserves future Phase 2 wiring; performance.now() for wall-clock window boundary; dbFsFromRms imported from measurement.ts only
- [Phase 03-calibration-measurement-show-control]: Up/down arrow buttons for reorder (not HTML5 drag-and-drop) — simpler code, fits moveDemo direction enum
- [Phase 03-calibration-measurement-show-control]: Redo confirm is inline bar within the row (not modal) — transforms score area in place on requestRedo
- [Phase 03-calibration-measurement-show-control]: onMeasure prop injected into DemoCard/DemoListEditor — measurement orchestration owned by Plan 03-05, not the card
- [Phase 03-calibration-measurement-show-control]: Two useEffects in MeasurementOrchestrator: main run effect + abortMessage observer — necessary because engine resolves after store already updated abortMeasure
- [Phase 03-calibration-measurement-show-control]: abortReasonRef tracking: sets 'device-change' before calling controller.abort() so store gets precise reason (engine always returns 'manual' for signal-triggered aborts)
- [Phase 03-calibration-measurement-show-control]: CountdownOverlay renders AbortWarning in same DOM slot (both absolute inset-0) — orchestrator switches phase.kind; no unmount/remount flicker
- [Phase 03-calibration-measurement-show-control P06]: AudioEngine promoted to module-level singleton — all consumers (MicPanel, CalibrateButton, MeasurementOrchestrator) share one permission-granted engine; per-component instantiation was silently breaking calibration and measurement
- [Phase 03-calibration-measurement-show-control P06]: WindowPicker unselected text bumped from text-gray-500 to text-gray-700 for WCAG AA contrast (Lighthouse audit on deployed URL flagged insufficient ratio)
- [Phase 03-calibration-measurement-show-control P06]: MeasurementOrchestrator mounted as last child of relative-positioned main so absolute inset-0 overlay covers exactly the main area; PersistenceBanner above main stays visible during measurement
- [Phase 04-two-surface-architecture P01]: MockBroadcastChannel added to setup.ts globalThis (not per-file vi.mock) — jsdom 29.1.1 has no BroadcastChannel; global assignment covers all transitively importing test files
- [Phase 04-two-surface-architecture P01]: reveal-buildup kept in ProjectorMessage union as projector-internal-only variant — host invariant test asserts deriveProjectorMessage never returns it (04-RESEARCH.md Pitfall 4)
- [Phase 04-two-surface-architecture P01]: ProjectorMessageState interface decoupled from useAppStore — avoids circular import when Plan 02 adds revealWinner using deriveWinner return type; enables pure synchronous testing

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 risk: AGC constraint application can vary by Windows audio driver — must test `track.getSettings()` on the actual event laptop (not just dev). Log `audioContext.sampleRate` at startup.
- Phase 4 risk: Multi-monitor window migration on Windows must be tested on actual hardware. `/projector` URL design mitigates lost projector window but must be verified.

## Session Continuity

Last session: 2026-05-05T23:14:57.997Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-two-surface-architecture/04-CONTEXT.md
