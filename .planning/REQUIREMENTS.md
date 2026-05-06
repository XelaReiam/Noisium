# Requirements: Noisium

**Defined:** 2026-05-06
**Core Value:** The host can run a multi-demo applause contest end-to-end on a single laptop on the day of the event, with each demo's score captured fairly and the winner revealed with confidence.

## v1.2 Requirements

Requirements for the v1.2 milestone. Each maps to roadmap phases (starting from Phase 8).

### Transport

- [x] **TRANS-01**: Host can toggle "Local Network Mode" on/off in the host UI (default: off)
- [x] **TRANS-02**: When Local Network Mode is off, app uses BroadcastChannel (existing same-machine behavior, unchanged)
- [x] **TRANS-03**: When Local Network Mode is on, BroadcastBridge switches to WebSocket transport
- [x] **TRANS-04**: Transport switch happens without page reload

### CLI

- [ ] **CLI-01**: Running `npx noisium` starts a local server that serves the built app over HTTP on the LAN
- [ ] **CLI-02**: CLI starts a WebSocket relay on the same port that relays host→projector messages
- [ ] **CLI-03**: CLI detects and prints the LAN IP + URL (e.g. `http://192.168.1.42:4000`) on startup
- [ ] **CLI-04**: CLI requires no configuration — zero-argument startup works out of the box

### Connection UX

- [x] **CONN-01**: When Local Network Mode is on, host UI shows the projector URL to open on the other machine
- [x] **CONN-02**: Host UI shows connection status: waiting for projector / projector connected / projector disconnected
- [x] **CONN-03**: If WebSocket connection drops mid-show, host sees a reconnecting warning
- [x] **CONN-04**: Projector tab auto-reconnects to the WebSocket server after a drop (with retry backoff)

## Future Requirements

Deferred to future milestones.

### Multi-Device Measurement

- **MULTI-01**: Multiple devices positioned around the hall each capture applause independently
- **MULTI-02**: Host display shows averaged score across all connected devices
- **MULTI-03**: If a device drops mid-measurement, score uses last stable average; connected device count is visible

### Polish

- **POLISH-01**: Audio recording of each applause clip (host device only)
- **POLISH-02**: Event branding — configurable logo, event name, color theme on projector screens
- **POLISH-03**: Animated full-leaderboard reveal as opt-in alternative to winner-only

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Audience devices vote-by-clap | Scope not justified over single-mic measurement |
| Live dB meter visible to audience | Anti-feature — strategic clapping distorts average |
| Per-demo score reveal between demos | Anchor bias, ruins suspense |
| Full leaderboard by default | Publicly shames last place at professional conferences |
| Absolute dB SPL display | Web Audio cannot calibrate to absolute SPL without hardware |
| Backend / server-side storage | v1.x is single-host; multi-device deferred to v2 |
| WebSocket over internet / cloud relay | LAN-only for v1.2; cloud relay is v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRANS-01 | Phase 8 | Complete |
| TRANS-02 | Phase 8 | Complete |
| TRANS-03 | Phase 8 | Complete |
| TRANS-04 | Phase 8 | Complete |
| CLI-01 | Phase 9 | Pending |
| CLI-02 | Phase 9 | Pending |
| CLI-03 | Phase 9 | Pending |
| CLI-04 | Phase 9 | Pending |
| CONN-01 | Phase 8 | Complete |
| CONN-02 | Phase 8 | Complete |
| CONN-03 | Phase 8 | Complete |
| CONN-04 | Phase 8 | Complete |

**Coverage:**
- v1.2 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after v1.2 roadmap created*
