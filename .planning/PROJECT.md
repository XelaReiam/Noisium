# Noisium

## What This Is

A browser-based applause meter for conference "DemoJam" segments — events where companies present an app in 3 minutes and the audience picks the winner by clapping rather than voting. The host pre-loads the demo lineup, runs each demo through a fixed measurement window, captures average dB from the device microphone, and reveals the winner at the end. Built for a community DemoJam this Friday, then open-sourced for other organizers to reuse.

## Core Value

The host can run a multi-demo applause contest end-to-end on a single laptop on the day of the event, with each demo's score captured fairly and the winner revealed with confidence. **If everything else fails, this must work.**

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- v1 scope for Friday's conference. -->

- [ ] Host pre-loads a list of demos (company name minimum) before the event
- [ ] Pre-show baseline calibration step (room ambient + sample test clap) sets the scale
- [ ] Configurable measurement window length (e.g. 5/8/10 seconds), adjustable in-app
- [ ] Host triggers measurement per demo: countdown → fixed window → captures **average** dB
- [ ] Audience-facing projector view shows suspense (no live meter) during measurement
- [ ] After each demo, score is captured silently and shown **only privately to the host** (audience sees nothing yet)
- [ ] Host can **skip** a demo (no-show) or **redo** a measurement (glitch / bad capture)
- [ ] At the end of all demos, projector view reveals **winner only** (no full leaderboard)
- [ ] State persists locally (localStorage / IndexedDB) so a tab refresh mid-event doesn't lose scores
- [ ] Clean, modern projector styling (big numbers, tasteful, conference-professional)
- [ ] Works in a modern desktop browser using the Web Audio API for mic-based dB measurement

### Out of Scope

<!-- Deferred post-Friday or excluded entirely. Each entry has a reason. -->

- **Multi-device session sync** (orga team joins via link, host triggers all devices simultaneously, average across devices) — Originally requested as the differentiator, deferred to v2: real-time sync across devices is 1–2 days of fragile work, too risky for the Friday deadline. Cut to keep v1 shippable.
- **Per-demo logo / tagline / presenter metadata on suspense screen** — v2 polish; v1 ships with company name only.
- **Audio recording** of each applause (clips for posterity / sharing) — v2 nice-to-have; not core to picking the winner.
- **Sound and visual feedback** (confetti, cheering animations, rising bar visualizations) — v2 polish; v1 reveal can be plain.
- **Sponsor / event branding slots** (logos, themed colors, event-specific styling) — v2; v1 uses generic clean styling. Project is generic from day one, branding is just deferred.
- **Audience devices vote-by-clap** (every audience member opens the app on their phone, distributed measurement) — Out entirely. Scope and complexity not justified for the value over single-mic measurement.
- **Animated leaderboard reveal** — Replaced with simpler "winner only" reveal per host preference.
- **Live dB meter visible to audience during measurement** — Replaced with suspense / dramatic reveal style.
- **Full leaderboard reveal** at end — Replaced with winner-only.
- **Per-demo score reveal to audience** between demos — Host-private only; preserves suspense for the final winner reveal.

## Context

- This is for a community-organized conference happening **Friday 2026-05-08** (3 days from project start). Hard deadline.
- The host (presumably the user or a fellow organizer) operates the app live from a single laptop connected to the projector; same device, same physical spot, same room for every demo — so raw dB readings are "fair enough" once a single baseline calibration is done.
- Web microphone dB readings are inherently relative (depend on device, mic gain, distance, room acoustics). Baseline calibration before the show normalizes the scale; recalibrating per-demo was considered and rejected as flow friction.
- The voting mechanic — clap, not click — is part of the event's identity. No physical buttons, no QR-code voting, no app downloads for attendees.
- Project will be **open-sourced** so other community DemoJam organizers can reuse it. v1 should already be generic (no hardcoded conference identity); the configurable branding feature is the only thing deferred.

## Constraints

- **Timeline**: v1 must ship by **Friday 2026-05-08** — 3 days from today. Drives ruthless scope cutting and "boring tech" defaults.
- **Platform**: Browser-only (no native, no install on host or audience side). Uses Web Audio API / `getUserMedia` for microphone access.
- **Network**: Online OK at the venue, no offline-first requirement. (Multi-device sync was the only thing that hard-required network; deferred.)
- **Operator**: Single host on a single device for v1. Designed around the host's UX, not an audience-facing one.
- **Open source**: Code will be public, so generic-from-day-one (no hardcoded event branding), and reasonable docs for v1 (README minimum, polish later).

## Key Decisions

<!-- Decisions made during initial questioning. Add throughout the project. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-device, host-only operation for v1 | Multi-device sync is the originally-requested feature but adds 1–2 days of real-time wiring; cut to make Friday | — Pending |
| Fixed measurement window with **average** dB (not peak, not manual stop) | Average smooths out a single loud whoop; fixed window keeps pacing consistent and fair across demos | — Pending |
| Window length configurable in-app | Host can dial in fairness vs. pacing on the day; no recompile | — Pending |
| One pre-show baseline calibration (not per-demo recalibration) | Same device, same spot — single calibration is "fair enough" without flow friction during the show | — Pending |
| Score hidden during the show; **winner only** at the end | Host wants suspense; avoids social pressure of audiences trying to "beat" the previous score | — Pending |
| Host sees each demo's score privately right after capture | Confirms the reading was recorded, lets host catch glitches and trigger a redo | — Pending |
| State persists locally (localStorage / IndexedDB) | Tab refresh mid-event is a foreseeable disaster; cheap to prevent | — Pending |
| Audio recording, confetti, sponsor branding, per-demo logos/taglines/presenters all deferred | v2 polish; not load-bearing for picking the winner | — Pending |
| Open-sourced, generic from day one (no hardcoded conference branding) | Cheaper than retrofitting later; the open-source aim is real, not aspirational | — Pending |

---
*Last updated: 2026-05-05 after initialization*
