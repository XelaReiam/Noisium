# Noisium

## What This Is

A browser-based applause meter for conference "DemoJam" segments — events where companies present an app in 3 minutes and the audience picks the winner by clapping rather than voting. The host pre-loads the demo lineup, runs each demo through a fixed measurement window, captures average dB from the device microphone, and reveals the winner at the end. Built for a community DemoJam and open-sourced for other organizers to reuse.

## Core Value

The host can run a multi-demo applause contest end-to-end on a single laptop on the day of the event, with each demo's score captured fairly and the winner revealed with confidence. **If everything else fails, this must work.**

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Host pre-loads a list of demos (company name minimum) before the event — v1.0
- ✓ Pre-show baseline calibration (~3s) captures room ambient noise floor — v1.0
- ✓ Configurable measurement window length (5/8/10 seconds), adjustable in-app — v1.0
- ✓ Host triggers measurement per demo: countdown → fixed window → captures average dB — v1.0
- ✓ Audience-facing projector view shows suspense (no live meter) during measurement — v1.0
- ✓ Score captured silently and shown only privately to the host after each demo — v1.0
- ✓ Host can skip a demo (no-show) or redo a measurement with confirmation — v1.0
- ✓ At the end of all demos, projector reveals winner only (no full leaderboard) — v1.0
- ✓ State persists locally (localStorage) so a tab refresh mid-event doesn't lose scores — v1.0
- ✓ Clean, modern projector styling (big typography, conference-professional) — v1.0
- ✓ Works in modern desktop browsers using Web Audio API mic-based dB measurement — v1.0
- ✓ AGC disabled and verified via track.getSettings() — v1.0
- ✓ App blocks plain HTTP and shows HTTPS-required message — v1.0
- ✓ Projector tab syncs via BroadcastChannel; reconnects on close+reopen — v1.0
- ✓ BroadcastChannel messages carry only projector-safe slice (no raw scores) — v1.0
- ✓ Host can add a subject (app name / topic) per demo — v1.1
- ✓ Host can upload a logo image per demo; preview shown in editor — v1.1
- ✓ Projector suspense screen shows company name, subject, and logo during measurement — v1.1
- ✓ Subject and logo persist to localStorage with the session — v1.1
- ✓ Host can download session results as CSV (name, subject, score, rank, status, winner) — v1.1
- ✓ Projector shows confetti animation on winner reveal — v1.1

### Active

<!-- v1.2 scope: Local Network Projector Mode -->

- [ ] Host can toggle "Local Network Mode" in the app (default: same-machine BroadcastChannel)
- [ ] When Local Network Mode is on, host sees their LAN IP and instructions to open the projector URL on another machine
- [ ] A companion CLI (`npx noisium`) starts a local WebSocket relay + serves the app over HTTP on the LAN
- [ ] When Local Network Mode is on, BroadcastBridge switches from BroadcastChannel to WebSocket transport
- [ ] Projector machine connects to the CLI-served app at `http://<LAN-IP>:<PORT>/#/projector` and receives messages via WebSocket
- [ ] Connection status visible on host (connected / waiting / disconnected)
- [ ] If WebSocket connection drops, host sees a warning; projector shows reconnecting state

### Out of Scope

<!-- Deferred post-v1.1 or excluded entirely. -->

- **Multi-device measurement averaging** (multiple mics around the hall, averaged score) — deferred to v2: requires multi-client coordination logic beyond relay.
- **Per-demo logo / tagline / presenter metadata on suspense screen** — shipped in v1.1.
- **Audio recording** of each applause (clips for posterity / sharing) — v2 nice-to-have.
- **Sponsor / event branding slots** (logos, themed colors, event-specific styling) — v2; v1 uses generic clean styling.
- **Audience devices vote-by-clap** — Out entirely. Scope not justified over single-mic.
- **Animated leaderboard reveal** — Replaced with winner-only reveal.
- **Live dB meter visible to audience during measurement** — Anti-feature (strategic clapping distorts average).
- **Full leaderboard reveal at end** — Anti-feature at professional conferences.
- **Per-demo score reveal to audience between demos** — Host-private only; preserves suspense.

## Current Milestone: v1.2 Local Network Projector Mode

**Goal:** Allow the projector to run on a separate machine on the same LAN — host toggles "Local Network Mode", runs `npx noisium` to start a local relay, and the projector machine connects via browser.

**Target features:**
- In-app feature toggle (BroadcastChannel default → WebSocket when enabled)
- Companion CLI (`npx noisium`) — Node.js WebSocket relay + static app server
- LAN IP/URL discovery and display in host UI
- Connection status indicators on both host and projector
- Graceful reconnect on drop

## Context

- v1.1 shipped 2026-05-06 — per-demo metadata (subject, logo), CSV export, confetti animation.
- 261 passing Vitest tests. Tech stack: Vite + React 19 + TypeScript + Tailwind v4 + Zustand + Web Audio API.
- BroadcastChannel currently hardwired in `src/lib/broadcastChannel.ts` and consumed by `BroadcastBridge.tsx` (host) and `ProjectorView.tsx` (projector). Transport abstraction needed before adding WebSocket.
- CLI will be a separate npm package (`packages/noisium-server`) in a monorepo or a simple `server/` directory — to be decided in research.
- Known limitations: AGC constraint application can vary by Windows audio driver — recommend testing `track.getSettings()` on the actual event laptop before the show.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-device, host-only operation for v1 | Multi-device sync is 1–2 days of fragile work; cut to make Friday | ✓ Good — worked as designed on the day |
| Fixed measurement window with **average** dB (not peak, not manual stop) | Average smooths out a single loud whoop; fixed window keeps pacing fair | ✓ Good — delta-dB scoring proved reliable |
| Window length configurable in-app (5/8/10s) | Host can dial in fairness vs. pacing on the day; no recompile | ✓ Good — useful flexibility with no complexity cost |
| One pre-show baseline calibration (recalibration available, not per-demo forced) | Same device, same spot; single calibration is "fair enough" without friction | ✓ Good — Phase 5 removed spurious demo-count gate so pre-calibration works before adding demos |
| Score hidden during the show; **winner only** at the end | Host wants suspense; avoids anchor bias in later clapping | ✓ Good — projector privacy invariant holds at type level and runtime |
| Host sees each demo's score privately right after capture | Confirms reading was recorded, lets host catch glitches and redo | ✓ Good — skip/redo worked well as escape hatches |
| State persists locally (localStorage) | Tab refresh mid-event is a foreseeable disaster; cheap to prevent | ✓ Good — partialize pattern cleanly separates persisted vs. transient |
| HashRouter (no basename issues with GitHub Pages) | Vite base and HashRouter basename are orthogonal; combining double-encodes | ✓ Good — hash routing transparent to end users |
| AudioEngine as module-level singleton | All consumers share one permission-granted instance; per-component broke calibration | ✓ Good — discovered in Phase 3 wave 4, fixed immediately |
| BroadcastBridge as render-null host relay | Store-write-then-derive eliminates imperative channel calls scattered across components | ✓ Good — Phase 5 unified all posts through BroadcastBridge cleanly |
| ProjectorMessage discriminated union with no score fields | Type-level privacy invariant enforced at compile time + 26+ runtime tests | ✓ Good — projector tab cannot accidentally show scores |
| Audio recording, confetti, sponsor branding, per-demo logos deferred | v2 polish; not load-bearing for picking the winner | ✓ Good — ruthless scoping made Friday deadline feasible |
| Open-sourced, generic from day one (no hardcoded conference branding) | Cheaper than retrofitting later; the open-source aim is real | ✓ Good — no event-specific content in codebase |

## Constraints

- **Timeline**: v1.0 shipped on 2026-05-06, ahead of Friday 2026-05-08 hard deadline.
- **Platform**: Browser-only (no native, no install). Web Audio API / `getUserMedia` for microphone access.
- **Network**: Online OK at venue, no offline-first requirement. (Multi-device sync deferred to v2.)
- **Operator**: Single host on a single device for v1.
- **Open source**: Code is public and generic from day one.

| Local Network Mode toggle with BroadcastChannel default | Keeps same-machine flow intact; LAN mode is opt-in upgrade | — Pending |
| Companion CLI serves app + WebSocket relay | GitHub Pages is static — can't host WS; CLI is the only clean option for offline/LAN use | — Pending |
| Transport abstraction (pluggable channel interface) | BroadcastBridge must switch transport at runtime; abstraction keeps component code unchanged | — Pending |

---
*Last updated: 2026-05-06 after v1.1 milestone, v1.2 started*
