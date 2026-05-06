# Noisium

A browser-based applause meter for conference DemoJam events — where companies pitch an app in 3 minutes and the audience picks the winner by clapping.

**Live:** https://xelareiam.github.io/Noisium/

---

## What it does

The host runs the app on a laptop connected to a projector. Audience members don't install anything — they just clap.

1. **Setup** — Host pre-loads the list of demos (company names). Configures measurement window (5, 8, or 10 seconds).
2. **Calibrate** — Host captures a 3-second ambient baseline before the show starts. This sets the room's noise floor so every demo is scored relative to the same reference.
3. **Measure** — For each demo, the host clicks "Measure". A 3-2-1 countdown plays, then the app captures average microphone dB across the fixed window. The score is stored as delta-dB above the ambient baseline.
4. **Private scores** — After each demo, only the host sees the captured score. The audience sees nothing yet.
5. **Projector tab** — A second browser tab at `#/projector` runs on the projector screen. It shows a suspense screen ("Clap now!") during measurement and stays blank between demos. Raw scores are never sent to this tab.
6. **Reveal** — When all demos have been measured, the host clicks "Reveal winner". The projector tab shows the winning demo name with an animation. No leaderboard, no other scores — just the winner.

The host can skip a demo (no-show) or redo a measurement (bad capture) at any point.

---

## Why it works this way

**Delta-dB scoring, not absolute dB.** Web microphones can't be calibrated to absolute SPL — readings vary by device, mic gain, and room acoustics. By measuring a baseline before the show and scoring each demo as "how much louder than silence", all demos compete on the same relative scale regardless of hardware.

**Average dB over a fixed window, not peak.** A single loud whoop at second 1 shouldn't win. The fixed window with average dB smooths out individual outliers and keeps pacing consistent across demos.

**AGC disabled and checked.** Automatic Gain Control (AGC) would compress loud applause toward a flat line, making every demo sound equally loud. The app requests AGC, echo cancellation, and noise suppression off via `getUserMedia` constraints, then checks the browser-reported settings via `track.getSettings()` and warns if they disagree. Note: the browser reports what it believes is set — OS-level drivers, Bluetooth headsets, and venue DSP hardware can still apply processing regardless.

**AudioContext on user gesture.** Browsers require microphone access to be initiated by a user click (not on page load). The "Enable microphone" button creates the AudioContext inside the click handler, ensuring `audioContext.state === 'running'` before any measurement starts.

**Projector tab via BroadcastChannel.** The host and projector tabs run on the same laptop, same browser, same origin. BroadcastChannel is a zero-infrastructure broadcast API for exactly this case. The host tab drives a `ProjectorMessage` discriminated union — the message type system enforces that raw scores are never included in channel messages at compile time.

**localStorage persistence.** A tab refresh mid-event shouldn't lose the show. Demo list, scores, calibration baseline, and current phase all persist to localStorage. A cross-day guard prompts the host on the morning after a practice session to avoid contaminating live event scores with yesterday's data.

**HTTPS guard.** `getUserMedia` requires a secure context. The app blocks itself from running over plain HTTP (non-localhost) and shows a clear message rather than a confusing blank screen.

---

## Architecture

```
src/
├── components/
│   ├── HostView.tsx                 # Main host control surface
│   ├── BroadcastBridge.tsx          # Render-null relay: store → BroadcastChannel
│   ├── MicPanel.tsx                 # Enable mic / error / live VU indicator
│   ├── CalibrateButton.tsx          # 3-2-1 calibration inline countdown
│   ├── MeasurementOrchestrator.tsx  # Countdown + measurement + abort handling
│   ├── DemoListEditor.tsx           # Add/reorder demos
│   ├── DemoCard.tsx                 # Per-demo score, skip, redo controls
│   ├── ProjectorView.tsx            # Projector tab — subscribes to BroadcastChannel
│   ├── ProjectorIdle.tsx            # Wordmark screen
│   ├── ProjectorCountdown.tsx       # 3-2-1 big countdown
│   ├── ProjectorSuspense.tsx        # "Clap now!" + rAF progress bar
│   └── ProjectorReveal.tsx          # "And the winner is…" animation
├── lib/
│   ├── audioEngine.ts               # AGC-disabled getUserMedia, AnalyserNode, calibrate/measure
│   ├── broadcastChannel.ts          # Module-level BroadcastChannel singleton
│   ├── measurement.ts               # Pure functions: RMS → dBFS, delta-dB, scoring
│   └── projector.ts                 # Pure functions: deriveProjectorMessage, deriveWinner, canRevealWinner
├── store/
│   └── useAppStore.ts               # Zustand store with localStorage persist (partialize)
└── App.tsx                          # HashRouter: / → HostView, #/projector → ProjectorView
```

**Key patterns:**

- **Render-null effect components** — Side effects (BroadcastBridge, CrossDayCheckEffect, MeasurementAbortGuard) live in their own render-null components with `useEffect`, keeping presentational components clean.
- **Store-write-then-derive** — Components write to Zustand store. BroadcastBridge subscribes to store changes, derives the projector message, and posts to the channel. No component posts to BroadcastChannel directly.
- **Pure-function core** — `measurement.ts` and `projector.ts` are plain TypeScript with no React or Web Audio dependencies. All business logic is tested in isolation.
- **Module-level AudioEngine singleton** — Web Audio allows one AudioContext per document. The engine is a module-level variable so all components share the same permission-granted instance.
- **Partialize persistence** — Only data fields (demo list, scores, calibration, session date, window setting) are persisted. Transient UI state (mic permission, measurement phase, projector connected) is excluded from localStorage.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React 19 + TypeScript | Concurrent features, strong typing |
| Build | Vite 8 | Fast HMR, straightforward GitHub Pages deploy |
| Styling | Tailwind v4 | Utility-first, no config files needed |
| State | Zustand 5 | Simple, supports `persist` middleware cleanly |
| Audio | Web Audio API | Native browser, no dependencies |
| Cross-tab | BroadcastChannel | Zero infrastructure for same-origin same-browser |
| Testing | Vitest + jsdom | Fast, Vite-native |
| Deploy | GitHub Actions → GitHub Pages | Zero infrastructure, free |

---

## Local development

```bash
npm install
npm run dev        # http://localhost:5173/Noisium/
npm run test       # 201 tests, ~4s
npm run build      # dist/ for production
```

To test the two-surface setup locally, open two tabs:
- `http://localhost:5173/Noisium/` — host view
- `http://localhost:5173/Noisium/#/projector` — projector view

---

## Status

**v1.0 shipped 2026-05-06** — all 26 requirements delivered and verified end-to-end.

| Requirement area | Status |
|-----------------|--------|
| Setup (HTTPS guard, window config, error handling) | ✓ Complete |
| Calibration (ambient baseline, AGC verification, recalibrate) | ✓ Complete |
| Measurement (countdown, fixed window, delta-dB, abort guard, skip/redo) | ✓ Complete |
| Persistence (localStorage, cross-day guard, incognito detection) | ✓ Complete |
| Projector (BroadcastChannel, suspense screen, winner reveal, resync) | ✓ Complete |

---

## Future enhancements

### Multi-device measurement (v1.1)

The single biggest improvement: multiple devices positioned around the hall each capture the applause independently, then average their readings. Devices in different acoustic positions (near stage, at back, at sides) produce a more representative reading than a single mic.

**Planned flow:**
- Host generates a session URL (e.g. `/session/ABC123`)
- Other organizers open that URL on their laptop or phone — minimal "client" UI, just calibrate and listen
- Each client calibrates from its own position (ambient level varies across the room)
- When host clicks Measure, all clients start capturing simultaneously
- Clients send their average dB to the session; host displays the averaged score
- If a device drops mid-measurement: keep the last stable average, show connected device count

**Requires:** A real-time relay backend (Firebase, Supabase, or Partykit) since BroadcastChannel only works within one browser on one machine.

### Per-demo metadata

Company logo, presenter names, and a tagline shown on the projector's suspense screen during measurement. The "Clap now!" screen becomes branded per demo rather than generic.

### Export results

Download scores as CSV or JSON after the show — useful for post-event recap emails or social posts.

### Animated leaderboard reveal

An alternative to winner-only reveal: animate through all demos from last to first, with the winner revealed last. Opt-in — winner-only remains the default.

### Audio recording

Optionally record the applause clip for each demo (host device only). Useful for sharing highlights or reviewing measurement quality after the event.

### Event branding

Configurable sponsor logos, event name, and color theme on the projector screens. Already designed to be generic — this just exposes the configuration knobs.

---

## License

MIT
