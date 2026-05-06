# Roadmap: Noisium

## Overview

Four phases deliver the applause meter in 3 days. Phase 1 lays the scaffold, state layer, and persistence before any audio or UI work begins. Phase 2 confirms the audio pipeline works — AGC disabled, AudioContext on gesture, level indicator live — before anything is built against it. Phase 3 wires the full calibration and measurement engine (these two are inseparable: calibration's baseline is what makes measurement scores meaningful) plus show control. Phase 4 splits the host tab from the projector tab via BroadcastChannel and delivers the winner reveal. Every v1 requirement is covered.

## Phases

- [x] **Phase 1: Scaffold + State Layer** - Vite/React scaffold, Zustand store, localStorage persistence with session-date guard, HTTPS guard, deployment
- [x] **Phase 2: Audio Pipeline** - AGC-disabled getUserMedia, AudioContext on user gesture, AnalyserNode, real-time level indicator, mic error states
- [x] **Phase 3: Calibration + Measurement + Show Control** - Demo list setup, ambient baseline calibration, countdown-to-measurement, average dB scoring, skip/redo, private host scores
- [ ] **Phase 4: Two-Surface Architecture** - BroadcastChannel bridge, projector URL/view, suspense screen, winner-only reveal, projector styling, tab reconnect

## Phase Details

### Phase 1: Scaffold + State Layer
**Goal**: The app is reachable over HTTPS, state survives a tab refresh, and the host sees a clear warning in any condition where persistence or HTTPS is broken.
**Depends on**: Nothing (first phase)
**Requirements**: SET-02, SET-04, PERS-01, PERS-02, PERS-03
**Success Criteria** (what must be TRUE):
  1. Scaffolded app deploys to HTTPS and loads on a second device without errors
  2. Refreshing the tab mid-session restores the full app state (demo list, scores, current phase)
  3. Loading the app in incognito mode shows a persistent warning that persistence is off — app still runs
  4. Loading the app the day after a practice session prompts "start fresh?" rather than silently restoring stale scores
  5. Opening the app over plain HTTP (non-localhost) shows a clear HTTPS-required message, not a blank screen
**Plans:** 3/3 plans complete
- [x] 01-01-PLAN.md — Scaffold Vite + React 19 + TS at repo root, Tailwind v4 plugin, GitHub Actions deploy to xelareiam.github.io/Noisium/
- [x] 01-02-PLAN.md — Zustand store with persist middleware (windowSeconds, sessionDate persisted; persistenceWorking, crossDayPromptShown transient) and localStorage probe wired in main.tsx
- [x] 01-03-PLAN.md — Guard UI (SecureContextBlocker, PersistenceBanner, CrossDayModal + CrossDayCheckEffect, WindowPicker) wrapped in HashRouter shell + manual checkpoint covering all 5 success criteria

### Phase 2: Audio Pipeline
**Goal**: The microphone is live, AGC is verifiably disabled, and the host can see real-time audio levels before entering the calibration flow.
**Depends on**: Phase 1
**Requirements**: SET-03, SET-05, CAL-02, CAL-03
**Success Criteria** (what must be TRUE):
  1. Clicking the mic-permission button creates the AudioContext and `audioContext.state === 'running'` is confirmed — no suspended context
  2. `track.getSettings()` confirms `autoGainControl: false`, `echoCancellation: false`, `noiseSuppression: false` after stream creation
  3. Denying mic permission shows a clear on-screen error with recovery instructions — not a blank screen or JS exception
  4. A real-time level indicator on the host view moves in response to sound (clapping, speaking) confirming the pipeline is live
**Plans:** 5/5 plans complete
- [x] 02-01-PLAN.md — Vitest infrastructure + browser detection + AGC verification + RMS math (pure-function units)
- [x] 02-02-PLAN.md — AudioEngine class (AGC-disabled getUserMedia, AudioContext-on-gesture, AnalyserNode rAF loop, error mapping) + unit tests
- [x] 02-03-PLAN.md — Store extension (transient mic fields), useAudioEngine hook, permission-loss wiring helper
- [x] 02-04-PLAN.md — MicPanel UI (Enable / Error / Live cards), 12-cell VU bar, device picker, HostView integration, CrossDayModal engine teardown
- [x] 02-05-PLAN.md — Manual verification checkpoint across Chrome/Edge + Firefox + phone, with cross-browser recovery-copy and OS-mic-indicator checks

### Phase 3: Calibration + Measurement + Show Control
**Goal**: The host can run a complete calibrate-then-measure cycle for all demos, with each demo's score captured fairly as a delta above the ambient baseline, and skip/redo controls available throughout.
**Depends on**: Phase 2
**Requirements**: SET-01, CAL-01, CAL-04, CAL-05, MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-06, SHOW-01, SHOW-02
**Success Criteria** (what must be TRUE):
  1. The host cannot trigger a measurement until calibration has completed — the measurement controls are gated
  2. Running calibration captures a 3-second ambient baseline; triggering a demo measurement then shows a countdown and captures an average dB score stored as delta above that baseline
  3. If the AudioContext loses `'running'` state or the mic device changes during measurement, the capture aborts and a visible warning appears — no silent bad reading is stored
  4. The host sees each demo's captured score privately after measurement completes
  5. The host can skip a demo (marked excluded) or redo a measurement with a brief confirmation; skipped and redone demos behave correctly in subsequent logic
**Plans:** 6/6 plans complete
- [x] 03-01-PLAN.md (Wave 1) — Pure-function measurement.ts module + Phase 2 partialize-test update (Wave 0 foundation)
- [x] 03-02-PLAN.md (Wave 2, parallel with 03-03) — Store extension: Phase 3 fields/actions, partialize update, clearSession extension
- [x] 03-03-PLAN.md (Wave 2, parallel with 03-02) — AudioEngine.startMeasurement + calibrate methods + tests
- [x] 03-04-PLAN.md (Wave 3, parallel with 03-05) — DemoListEditor + DemoCard + DemoStatusBadge components
- [x] 03-05-PLAN.md (Wave 3, parallel with 03-04) — CalibrateButton + CountdownOverlay + AbortWarning + MeasurementAbortGuard + MeasurementOrchestrator
- [x] 03-06-PLAN.md (Wave 4) — HostView wiring + manual verification checkpoint — APPROVED 2026-05-05

### Phase 4: Two-Surface Architecture
**Goal**: The projector tab shows the right screen for each show state — suspense during measurement, blank/between between demos, winner-only at the end — and the host's raw scores are never visible on the projector at any point.
**Depends on**: Phase 3
**Requirements**: MEAS-05, SHOW-03, PROJ-01, PROJ-02, PROJ-03, PROJ-04
**Success Criteria** (what must be TRUE):
  1. Opening `/projector` (or `#/projector`) in a second window shows the correct phase screen driven by host tab actions via BroadcastChannel
  2. Closing and reopening the projector tab during the show resyncs on the next host action — projector does not stay stuck in the last-seen state permanently
  3. The projector never displays raw per-demo scores; BroadcastChannel messages carry only `phase`, `currentDemoName`, `countdownSeconds`, and `winner`
  4. The projector shows a suspense screen (no live dB meter) while measurement is in progress
  5. After all demos are measured, the host triggers the reveal and the projector displays the winner only — no leaderboard, no other scores
**Plans:** 1/5 plans executed
- [ ] 04-01-PLAN.md (Wave 1) — Wave 0: MockBroadcastChannel test mock + src/lib/projector.ts pure functions (deriveWinner, deriveProjectorMessage, canRevealWinner) + BroadcastChannel singleton
- [ ] 04-02-PLAN.md (Wave 2, parallel with 04-03) — Store extension: Phase 4 transients (measurePhase, revealActive/revealWinner, projectorConnected) + actions (triggerReveal, resetReveal, refreshProjectorHeartbeat) + clearSession update; partialize unchanged
- [ ] 04-03-PLAN.md (Wave 2, parallel with 04-02) — ProjectorView + 4 sub-components (Idle, Countdown, Suspense, Reveal); replaces ProjectorPlaceholder; locally-animated buildup→reveal + rAF progress bar + window-end auto-fade; PROJ-04 request-state on mount; projector heartbeat
- [ ] 04-04-PLAN.md (Wave 3) — BroadcastBridge render-null component (subscribe-and-derive + dedup + request-state reply + heartbeat) + MeasurementOrchestrator setMeasurePhase wiring + 1.2s window-end hold + CalibrateButton calibrating/idle direct broadcasts
- [ ] 04-05-PLAN.md (Wave 4) — HostView wiring (mount BroadcastBridge, ProjectorToolbar header, Reveal/Reset buttons) + manual verification checkpoint covering all 6 Phase 4 requirements end-to-end on deployed URL with second monitor

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold + State Layer | 3/3 | Complete    | 2026-05-05 |
| 2. Audio Pipeline | 5/5 | Complete    | 2026-05-05 |
| 3. Calibration + Measurement + Show Control | 6/6 | Complete    | 2026-05-05 |
| 4. Two-Surface Architecture | 1/5 | In Progress|  |
