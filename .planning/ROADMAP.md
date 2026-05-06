# Roadmap: Noisium

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-05-06)
- [ ] **v1.1 Metadata + Export** — Phases 6–7 (in planning)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-05-06</summary>

Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

- [x] **Phase 1: Scaffold + State Layer** (3/3 plans) — completed 2026-05-05
  Vite/React scaffold, Zustand persist, HTTPS guard, cross-day session prompt, GitHub Pages deploy
- [x] **Phase 2: Audio Pipeline** (5/5 plans) — completed 2026-05-05
  AGC-disabled getUserMedia, AudioContext on gesture, AnalyserNode VU loop, mic error states
- [x] **Phase 3: Calibration + Measurement + Show Control** (6/6 plans) — completed 2026-05-05
  3s ambient calibration, countdown→measure→delta-dB scoring, AbortController guard, skip/redo
- [x] **Phase 4: Two-Surface Architecture** (5/5 plans) — completed 2026-05-06
  BroadcastChannel bridge, ProjectorView screens, privacy-invariant message union, winner reveal, tab resync
- [x] **Phase 5: Polish Broadcast Architecture** (1/1 plan) — completed 2026-05-06
  Unified broadcast path through BroadcastBridge, pre-calibration gate removed (TD-2 + TD-3 closed)

</details>

<details>
<summary>v1.1 Metadata + Export (Phases 6–7) — IN PLANNING</summary>

- [x] **Phase 6: Per-Demo Metadata** — Subject field + logo upload per demo; projector suspense screen shows company name, subject, and logo; persisted to localStorage (completed 2026-05-06)
- [ ] **Phase 7: Export + Confetti** — CSV download of session results; confetti animation on winner reveal screen

</details>

## Phase Details

### v1.0 MVP

Archived. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

---

### v1.1 Metadata + Export

#### Phase 6: Per-Demo Metadata

**Goal**: Each demo carries a subject and optional logo that the host enters before the show, and the projector suspense screen displays them during measurement.

**Depends on**: Phase 5 (store shape, BroadcastBridge, ProjectorSuspense all stable)

**Requirements**: META-01, META-02, META-03, META-04

**Success Criteria** (what must be TRUE):
  1. Host can type a subject (app name / topic) into a demo row in the demo list editor and save the session without errors
  2. Host can upload a logo image file per demo; the logo preview appears in the editor row immediately
  3. When measurement starts, the projector suspense screen shows the company name, subject line, and logo for the current demo
  4. After a page refresh mid-session, subject and logo data survive — the editor shows previously entered values and the projector still shows them on the next measurement

**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Extend Demo type + updateDemoMeta action; extend ProjectorMessage 'measuring' variant with optional metadata fields
- [ ] 06-02-PLAN.md — DemoCard subject input + logo upload UI; ProjectorSuspense metadata rendering; ProjectorView wiring

---

#### Phase 7: Export + Confetti

**Goal**: After the show the host can download a complete results CSV, and the audience sees a confetti animation when the winner is revealed on the projector.

**Depends on**: Phase 6 (demo shape stable, subject field available for export)

**Requirements**: EXPORT-01, PROJ-05

**Success Criteria** (what must be TRUE):
  1. A "Download CSV" button is visible on the host results view after all demos have been measured; clicking it triggers a file download without a page navigation
  2. The downloaded CSV contains one row per demo with columns: demo name, subject, delta-dB score, rank, status, and winner flag — in that order
  3. When the projector tab transitions to the winner reveal screen, a confetti animation fires automatically and is visible on the projector display
  4. Confetti appears only on the projector (not the host view) and does not break or obscure the winner name display

**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — exportCsv pure-function library + DownloadCsvButton component + HostView wiring (EXPORT-01)
- [ ] 07-02-PLAN.md — ConfettiCanvas hand-rolled Canvas component + ProjectorReveal wiring (PROJ-05)

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold + State Layer | v1.0 | 3/3 | Complete | 2026-05-05 |
| 2. Audio Pipeline | v1.0 | 5/5 | Complete | 2026-05-05 |
| 3. Calibration + Measurement + Show Control | v1.0 | 6/6 | Complete | 2026-05-05 |
| 4. Two-Surface Architecture | v1.0 | 5/5 | Complete | 2026-05-06 |
| 5. Polish Broadcast Architecture | v1.0 | 1/1 | Complete | 2026-05-06 |
| 6. Per-Demo Metadata | v1.1 | 2/2 | Complete | 2026-05-06 |
| 7. Export + Confetti | 1/2 | In Progress|  | - |
