import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from './useAppStore';

// Reset store between tests by setting all fields back to defaults
beforeEach(() => {
  // Reset localStorage so the partialize tests see a clean write.
  localStorage.clear();
  useAppStore.setState({
    // Phase 1
    windowSeconds: 8,
    sessionDate: '2026-05-05',
    persistenceWorking: true,
    crossDayPromptShown: false,
    // Phase 2
    micPermission: 'idle',
    micDeviceId: null,
    audioReady: false,
    // Phase 3 persisted
    demos: [],
    scores: {},
    skippedDemoIds: [],
    // Phase 3 transient
    calibrationAmbientDb: null,
    measuringDemoId: null,
    abortedDemoId: null,
    abortMessage: null,
    redoConfirmDemoId: null,
    // Phase 4 transient
    measurePhase: 'idle',
    revealActive: false,
    revealWinner: null,
    projectorConnected: false,
    // Phase 8
    lanModeEnabled: false,
    wsConnectionStatus: 'idle',
  });
});

describe('useAppStore — Phase 2 mic state extension', () => {
  it('has correct defaults for new mic fields', () => {
    const s = useAppStore.getState();
    expect(s.micPermission).toBe('idle');
    expect(s.micDeviceId).toBeNull();
    expect(s.audioReady).toBe(false);
  });

  it('setMicPermission updates state', () => {
    useAppStore.getState().setMicPermission('granted');
    expect(useAppStore.getState().micPermission).toBe('granted');
  });

  it('setMicDeviceId updates state', () => {
    useAppStore.getState().setMicDeviceId('dev-abc');
    expect(useAppStore.getState().micDeviceId).toBe('dev-abc');
  });

  it('setAudioReady updates state', () => {
    useAppStore.getState().setAudioReady(true);
    expect(useAppStore.getState().audioReady).toBe(true);
  });
});

describe('useAppStore — clearSession resets mic state', () => {
  it('resets all three mic fields to defaults', () => {
    const s = useAppStore.getState();
    s.setMicPermission('granted');
    s.setMicDeviceId('dev-x');
    s.setAudioReady(true);

    s.clearSession();

    const after = useAppStore.getState();
    expect(after.micPermission).toBe('idle');
    expect(after.micDeviceId).toBeNull();
    expect(after.audioReady).toBe(false);
  });

  it('still resets windowSeconds and sessionDate (Phase 1 behavior preserved)', () => {
    const s = useAppStore.getState();
    s.setWindowSeconds(10);
    s.clearSession();
    expect(useAppStore.getState().windowSeconds).toBe(8);
    expect(useAppStore.getState().sessionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('useAppStore — partialize invariant (Phase 3 shape)', () => {
  it('localStorage payload contains exactly the Phase 3 persisted keys', () => {
    // Trigger a write
    useAppStore.getState().setMicPermission('granted');
    useAppStore.getState().setMicDeviceId('dev-leaky');
    useAppStore.getState().setAudioReady(true);
    useAppStore.getState().setWindowSeconds(10);

    const raw = localStorage.getItem('noisium:state');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    // Persisted shape: { state: {...}, version: 0 }
    const stateKeys = Object.keys(parsed.state).sort();
    // Phase 3 expanded shape: original two keys + demos + scores + skippedDemoIds
    // Phase 8: lanModeEnabled added as persisted device preference
    expect(stateKeys).toEqual([
      'demos',
      'lanModeEnabled',
      'scores',
      'sessionDate',
      'skippedDemoIds',
      'windowSeconds',
    ]);
  });

  it('transient fields are NOT in localStorage', () => {
    // Trigger a write so storage is populated
    useAppStore.getState().setWindowSeconds(8);

    const raw = localStorage.getItem('noisium:state');
    const parsed = JSON.parse(raw as string);

    // Phase 1 + Phase 2 transients must remain excluded
    expect(parsed.state).not.toHaveProperty('persistenceWorking');
    expect(parsed.state).not.toHaveProperty('crossDayPromptShown');
    expect(parsed.state).not.toHaveProperty('micPermission');
    expect(parsed.state).not.toHaveProperty('micDeviceId');
    expect(parsed.state).not.toHaveProperty('audioReady');

    // Phase 3 transients must also be excluded
    expect(parsed.state).not.toHaveProperty('calibrationAmbientDb');
    expect(parsed.state).not.toHaveProperty('measuringDemoId');
    expect(parsed.state).not.toHaveProperty('abortedDemoId');
    expect(parsed.state).not.toHaveProperty('abortMessage');
    expect(parsed.state).not.toHaveProperty('redoConfirmDemoId');
  });
});

describe('useAppStore — Phase 3 demo CRUD', () => {
  it('addDemo trims whitespace and appends with a UUID id', () => {
    useAppStore.getState().addDemo('  Acme Corp  ');
    const demos = useAppStore.getState().demos;
    expect(demos).toHaveLength(1);
    expect(demos[0].name).toBe('Acme Corp');
    // crypto.randomUUID format: 8-4-4-4-12 hex chars
    expect(demos[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('addDemo ignores empty and whitespace-only input', () => {
    useAppStore.getState().addDemo('');
    useAppStore.getState().addDemo('   ');
    useAppStore.getState().addDemo('\t\n');
    expect(useAppStore.getState().demos).toHaveLength(0);
  });

  it('addDemo allows duplicate names (per CONTEXT decision)', () => {
    useAppStore.getState().addDemo('Acme');
    useAppStore.getState().addDemo('Acme');
    const demos = useAppStore.getState().demos;
    expect(demos).toHaveLength(2);
    expect(demos[0].name).toBe('Acme');
    expect(demos[1].name).toBe('Acme');
    // But IDs must differ
    expect(demos[0].id).not.toBe(demos[1].id);
  });

  it('removeDemo removes the demo, its score, AND its skip entry', () => {
    useAppStore.getState().addDemo('A');
    useAppStore.getState().addDemo('B');
    const [a, b] = useAppStore.getState().demos;
    // Seed score and skip on demo A
    useAppStore.setState({
      scores: { [a.id]: { avgDbFs: -30, deltaDb: 10, capturedAt: '2026-05-05' } },
      skippedDemoIds: [a.id],
    });

    useAppStore.getState().removeDemo(a.id);

    const after = useAppStore.getState();
    expect(after.demos).toHaveLength(1);
    expect(after.demos[0].id).toBe(b.id);
    expect(after.scores).not.toHaveProperty(a.id);
    expect(after.skippedDemoIds).not.toContain(a.id);
  });

  it('renameDemo updates only the matching demo, trims, ignores empty', () => {
    useAppStore.getState().addDemo('A');
    useAppStore.getState().addDemo('B');
    const [a] = useAppStore.getState().demos;

    useAppStore.getState().renameDemo(a.id, '  Renamed  ');
    expect(useAppStore.getState().demos[0].name).toBe('Renamed');

    useAppStore.getState().renameDemo(a.id, '   ');
    // Empty rename: no-op (still 'Renamed')
    expect(useAppStore.getState().demos[0].name).toBe('Renamed');
  });

  it("moveDemo swaps with adjacent in the requested direction; clamps at boundaries", () => {
    useAppStore.getState().addDemo('A');
    useAppStore.getState().addDemo('B');
    useAppStore.getState().addDemo('C');
    const [a, b, c] = useAppStore.getState().demos;

    // B up → [B, A, C]
    useAppStore.getState().moveDemo(b.id, 'up');
    expect(useAppStore.getState().demos.map((d) => d.id)).toEqual([b.id, a.id, c.id]);

    // B up again from index 0 → no-op
    useAppStore.getState().moveDemo(b.id, 'up');
    expect(useAppStore.getState().demos.map((d) => d.id)).toEqual([b.id, a.id, c.id]);

    // C down from index 2 → no-op
    useAppStore.getState().moveDemo(c.id, 'down');
    expect(useAppStore.getState().demos.map((d) => d.id)).toEqual([b.id, a.id, c.id]);

    // A down → [B, C, A]
    useAppStore.getState().moveDemo(a.id, 'down');
    expect(useAppStore.getState().demos.map((d) => d.id)).toEqual([b.id, c.id, a.id]);
  });
});

describe('useAppStore — Phase 3 calibration', () => {
  it('setCalibrationAmbient stores the value', () => {
    useAppStore.getState().setCalibrationAmbient(-45.2);
    expect(useAppStore.getState().calibrationAmbientDb).toBe(-45.2);
  });
});

describe('useAppStore — Phase 3 measurement lifecycle', () => {
  it('startMeasure sets measuringDemoId AND defensively clears abort/redo state', () => {
    // Seed stale abort + redo state
    useAppStore.setState({
      abortMessage: 'old warning',
      abortedDemoId: 'old-demo',
      redoConfirmDemoId: 'old-redo',
    });

    useAppStore.getState().startMeasure('demo-1');

    const s = useAppStore.getState();
    expect(s.measuringDemoId).toBe('demo-1');
    expect(s.abortMessage).toBeNull();
    expect(s.abortedDemoId).toBeNull();
    expect(s.redoConfirmDemoId).toBeNull();
  });

  it('completeMeasure writes a Score with correct deltaDb and clears measuringDemoId', () => {
    useAppStore.getState().setCalibrationAmbient(-50);
    useAppStore.getState().startMeasure('demo-1');
    useAppStore.getState().completeMeasure('demo-1', -30);

    const s = useAppStore.getState();
    expect(s.measuringDemoId).toBeNull();
    expect(s.scores['demo-1']).toBeDefined();
    expect(s.scores['demo-1'].avgDbFs).toBe(-30);
    expect(s.scores['demo-1'].deltaDb).toBe(20); // -30 - (-50) = 20
    expect(s.scores['demo-1'].capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('completeMeasure with no calibration treats baseline as 0 (delta === avgDbFs)', () => {
    expect(useAppStore.getState().calibrationAmbientDb).toBeNull();
    useAppStore.getState().completeMeasure('demo-1', -25);

    expect(useAppStore.getState().scores['demo-1'].deltaDb).toBe(-25);
  });

  it('completeMeasure removes the demo from skippedDemoIds (a measured demo is not skipped)', () => {
    useAppStore.setState({ skippedDemoIds: ['demo-1', 'demo-2'] });
    useAppStore.getState().completeMeasure('demo-1', -30);

    expect(useAppStore.getState().skippedDemoIds).toEqual(['demo-2']);
  });

  it('abortMeasure clears measuringDemoId AND sets abortedDemoId AND a non-empty abortMessage', () => {
    useAppStore.getState().startMeasure('demo-1');
    useAppStore.getState().abortMeasure('demo-1', 'state-change');

    const s = useAppStore.getState();
    expect(s.measuringDemoId).toBeNull();
    expect(s.abortedDemoId).toBe('demo-1');
    expect(s.abortMessage).toBeTruthy();
    expect(s.abortMessage).toContain('aborted');
  });

  it('abortMeasure produces different messages per reason', () => {
    useAppStore.getState().abortMeasure('demo-1', 'device-change');
    const m1 = useAppStore.getState().abortMessage;

    useAppStore.getState().abortMeasure('demo-1', 'state-change');
    const m2 = useAppStore.getState().abortMessage;

    expect(m1).not.toBe(m2);
    expect(m1).toMatch(/microphone/i);
    expect(m2).toMatch(/audio interrupted|interrupted/i);
  });

  it('clearAbort clears both abortMessage AND abortedDemoId', () => {
    useAppStore.getState().abortMeasure('demo-1', 'manual');
    useAppStore.getState().clearAbort();

    const s = useAppStore.getState();
    expect(s.abortMessage).toBeNull();
    expect(s.abortedDemoId).toBeNull();
  });
});

describe('useAppStore — Phase 3 skip / unskip', () => {
  it('skipDemo adds the id to skippedDemoIds; calling twice does not duplicate', () => {
    useAppStore.getState().skipDemo('demo-1');
    useAppStore.getState().skipDemo('demo-1');
    expect(useAppStore.getState().skippedDemoIds).toEqual(['demo-1']);
  });

  it('unskipDemo removes the id from skippedDemoIds', () => {
    useAppStore.setState({ skippedDemoIds: ['demo-1', 'demo-2'] });
    useAppStore.getState().unskipDemo('demo-1');
    expect(useAppStore.getState().skippedDemoIds).toEqual(['demo-2']);
  });
});

describe('useAppStore — Phase 3 redo flow', () => {
  it('requestRedo sets redoConfirmDemoId; cancelRedo clears it', () => {
    useAppStore.getState().requestRedo('demo-1');
    expect(useAppStore.getState().redoConfirmDemoId).toBe('demo-1');

    useAppStore.getState().cancelRedo();
    expect(useAppStore.getState().redoConfirmDemoId).toBeNull();
  });

  it('confirmRedo removes the prior score, clears redoConfirmDemoId, clears skip entry', () => {
    useAppStore.setState({
      scores: { 'demo-1': { avgDbFs: -30, deltaDb: 10, capturedAt: 'x' } },
      skippedDemoIds: ['demo-1'],
      redoConfirmDemoId: 'demo-1',
    });

    useAppStore.getState().confirmRedo('demo-1');

    const s = useAppStore.getState();
    expect(s.scores).not.toHaveProperty('demo-1');
    expect(s.skippedDemoIds).not.toContain('demo-1');
    expect(s.redoConfirmDemoId).toBeNull();
  });
});

describe('useAppStore — Phase 3 clearSession reset', () => {
  it('resets all Phase 3 persisted AND transient fields to defaults', () => {
    useAppStore.setState({
      demos: [{ id: 'x', name: 'X' }],
      scores: { x: { avgDbFs: -30, deltaDb: 10, capturedAt: 'now' } },
      skippedDemoIds: ['x'],
      calibrationAmbientDb: -45,
      measuringDemoId: 'x',
      abortedDemoId: 'x',
      abortMessage: 'something',
      redoConfirmDemoId: 'x',
    });

    useAppStore.getState().clearSession();

    const s = useAppStore.getState();
    expect(s.demos).toEqual([]);
    expect(s.scores).toEqual({});
    expect(s.skippedDemoIds).toEqual([]);
    expect(s.calibrationAmbientDb).toBeNull();
    expect(s.measuringDemoId).toBeNull();
    expect(s.abortedDemoId).toBeNull();
    expect(s.abortMessage).toBeNull();
    expect(s.redoConfirmDemoId).toBeNull();
  });
});

// ============================================================================
// Phase 4 tests
// ============================================================================

describe('Phase 4: store transient defaults', () => {
  it('defaults measurePhase to "idle"', () => {
    expect(useAppStore.getState().measurePhase).toBe('idle');
  });

  it('defaults revealActive to false and revealWinner to null', () => {
    expect(useAppStore.getState().revealActive).toBe(false);
    expect(useAppStore.getState().revealWinner).toBeNull();
  });

  it('defaults projectorConnected to false', () => {
    expect(useAppStore.getState().projectorConnected).toBe(false);
  });
});

describe('Phase 4: setMeasurePhase', () => {
  it.each(['countdown', 'measuring', 'window-end', 'idle'] as const)(
    'sets measurePhase to %s',
    (phase) => {
      useAppStore.getState().setMeasurePhase(phase);
      expect(useAppStore.getState().measurePhase).toBe(phase);
    },
  );
});

describe('Phase 4: triggerReveal / resetReveal', () => {
  it('is a no-op when no demos are measured', () => {
    useAppStore.getState().addDemo('Alpha');
    useAppStore.getState().triggerReveal();
    expect(useAppStore.getState().revealActive).toBe(false);
    expect(useAppStore.getState().revealWinner).toBeNull();
  });

  it('sets revealActive=true and the winner name when one demo is measured', () => {
    useAppStore.getState().addDemo('Alpha');
    const id = useAppStore.getState().demos[0].id;
    useAppStore.getState().setCalibrationAmbient(-50);
    useAppStore.getState().completeMeasure(id, -38);
    useAppStore.getState().triggerReveal();
    expect(useAppStore.getState().revealActive).toBe(true);
    expect(useAppStore.getState().revealWinner).toEqual({ name: 'Alpha' });
  });

  it('picks the higher delta when two demos differ', () => {
    useAppStore.getState().addDemo('Alpha');
    useAppStore.getState().addDemo('Bravo');
    const [a, b] = useAppStore.getState().demos.map((d) => d.id);
    useAppStore.getState().setCalibrationAmbient(-50);
    useAppStore.getState().completeMeasure(a, -40); // delta = 10
    useAppStore.getState().completeMeasure(b, -38); // delta = 12 — winner
    useAppStore.getState().triggerReveal();
    expect(useAppStore.getState().revealWinner).toEqual({ name: 'Bravo' });
  });

  it('produces a tie array when two demos have equal deltas', () => {
    useAppStore.getState().addDemo('Alpha');
    useAppStore.getState().addDemo('Bravo');
    const [a, b] = useAppStore.getState().demos.map((d) => d.id);
    useAppStore.getState().setCalibrationAmbient(-50);
    useAppStore.getState().completeMeasure(a, -40);
    useAppStore.getState().completeMeasure(b, -40);
    useAppStore.getState().triggerReveal();
    const winner = useAppStore.getState().revealWinner;
    expect(winner).toEqual({ names: expect.arrayContaining(['Alpha', 'Bravo']) });
  });

  it('excludes skipped demos when picking the winner', () => {
    useAppStore.getState().addDemo('Alpha');
    useAppStore.getState().addDemo('Bravo');
    const [a, b] = useAppStore.getState().demos.map((d) => d.id);
    useAppStore.getState().setCalibrationAmbient(-50);
    useAppStore.getState().completeMeasure(a, -38); // higher
    useAppStore.getState().completeMeasure(b, -42);
    useAppStore.getState().skipDemo(a); // skip the higher
    useAppStore.getState().triggerReveal();
    expect(useAppStore.getState().revealWinner).toEqual({ name: 'Bravo' });
  });

  it('resetReveal clears both fields', () => {
    useAppStore.getState().addDemo('Alpha');
    const id = useAppStore.getState().demos[0].id;
    useAppStore.getState().setCalibrationAmbient(-50);
    useAppStore.getState().completeMeasure(id, -38);
    useAppStore.getState().triggerReveal();
    expect(useAppStore.getState().revealActive).toBe(true);
    useAppStore.getState().resetReveal();
    expect(useAppStore.getState().revealActive).toBe(false);
    expect(useAppStore.getState().revealWinner).toBeNull();
  });
});

describe('Phase 4: setProjectorConnected and refreshProjectorHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('setProjectorConnected toggles the field', () => {
    useAppStore.getState().setProjectorConnected(true);
    expect(useAppStore.getState().projectorConnected).toBe(true);
    useAppStore.getState().setProjectorConnected(false);
    expect(useAppStore.getState().projectorConnected).toBe(false);
  });

  it('refreshProjectorHeartbeat sets connected immediately', () => {
    useAppStore.getState().refreshProjectorHeartbeat();
    expect(useAppStore.getState().projectorConnected).toBe(true);
  });

  it('clears connected after 5000ms with no further heartbeat', () => {
    useAppStore.getState().refreshProjectorHeartbeat();
    vi.advanceTimersByTime(4999);
    expect(useAppStore.getState().projectorConnected).toBe(true);
    vi.advanceTimersByTime(2);
    expect(useAppStore.getState().projectorConnected).toBe(false);
  });

  it('resets the staleness timer when called again', () => {
    useAppStore.getState().refreshProjectorHeartbeat();
    vi.advanceTimersByTime(3000);
    useAppStore.getState().refreshProjectorHeartbeat(); // resets the timer
    vi.advanceTimersByTime(3000); // 6s total but only 3s since last refresh
    expect(useAppStore.getState().projectorConnected).toBe(true);
    vi.advanceTimersByTime(2001);
    expect(useAppStore.getState().projectorConnected).toBe(false);
  });
});

describe('Phase 4: measurePhase consistency on abort/complete', () => {
  it('abortMeasure resets measurePhase to idle', () => {
    useAppStore.getState().addDemo('Alpha');
    const id = useAppStore.getState().demos[0].id;
    useAppStore.getState().startMeasure(id);
    useAppStore.getState().setMeasurePhase('measuring');
    useAppStore.getState().abortMeasure(id, 'manual');
    expect(useAppStore.getState().measurePhase).toBe('idle');
  });

  it('completeMeasure resets measurePhase to idle', () => {
    useAppStore.getState().addDemo('Alpha');
    const id = useAppStore.getState().demos[0].id;
    useAppStore.getState().setCalibrationAmbient(-50);
    useAppStore.getState().startMeasure(id);
    useAppStore.getState().setMeasurePhase('measuring');
    useAppStore.getState().completeMeasure(id, -38);
    expect(useAppStore.getState().measurePhase).toBe('idle');
  });
});

describe('Phase 4: clearSession resets transients', () => {
  it('clears every Phase 4 transient', () => {
    useAppStore.getState().setMeasurePhase('measuring');
    useAppStore.getState().setProjectorConnected(true);
    // Force revealActive without going through triggerReveal so the test is direct
    useAppStore.setState({ revealActive: true, revealWinner: { name: 'X' } });
    useAppStore.getState().clearSession();
    const s = useAppStore.getState();
    expect(s.measurePhase).toBe('idle');
    expect(s.revealActive).toBe(false);
    expect(s.revealWinner).toBeNull();
    expect(s.projectorConnected).toBe(false);
  });
});

// ============================================================================
// Phase 6 tests — updateDemoMeta (META-01 / META-02)
// ============================================================================

describe('useAppStore — updateDemoMeta (META-01 / META-02)', () => {
  it('sets subject on the matching demo and leaves others unchanged', () => {
    useAppStore.getState().addDemo('Alpha');
    useAppStore.getState().addDemo('Bravo');
    const [a, b] = useAppStore.getState().demos;

    useAppStore.getState().updateDemoMeta(a.id, { subject: 'My App' });

    const demos = useAppStore.getState().demos;
    expect(demos[0].subject).toBe('My App');
    expect(demos[1].subject).toBeUndefined();
    // b's name/id unchanged
    expect(demos[1].id).toBe(b.id);
    expect(demos[1].name).toBe(b.name);
  });

  it('sets logoUrl on the correct demo', () => {
    useAppStore.getState().addDemo('Alpha');
    const id = useAppStore.getState().demos[0].id;

    useAppStore.getState().updateDemoMeta(id, { logoUrl: 'data:image/png;base64,abc' });

    expect(useAppStore.getState().demos[0].logoUrl).toBe('data:image/png;base64,abc');
  });

  it('sets both subject and logoUrl atomically', () => {
    useAppStore.getState().addDemo('Alpha');
    const id = useAppStore.getState().demos[0].id;

    useAppStore
      .getState()
      .updateDemoMeta(id, { subject: 'x', logoUrl: 'data:image/png;base64,xyz' });

    const demo = useAppStore.getState().demos[0];
    expect(demo.subject).toBe('x');
    expect(demo.logoUrl).toBe('data:image/png;base64,xyz');
  });

  it('subject and logoUrl survive store state round-trip (fields accessible on the store)', () => {
    useAppStore.getState().addDemo('Acme');
    const id = useAppStore.getState().demos[0].id;

    useAppStore.getState().updateDemoMeta(id, { subject: 'Acme', logoUrl: 'data:...' });

    const demo = useAppStore.getState().demos[0];
    expect(demo.subject).toBe('Acme');
    expect(demo.logoUrl).toBe('data:...');
  });

  it('demo with subject and logoUrl persists within the demos array in localStorage — no new top-level keys', () => {
    useAppStore.getState().addDemo('Acme');
    const id = useAppStore.getState().demos[0].id;
    useAppStore.getState().updateDemoMeta(id, { subject: 'Acme Corp', logoUrl: 'data:...' });

    const raw = localStorage.getItem('noisium:state');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);

    // Top-level persisted keys (Phase 8: lanModeEnabled added)
    const stateKeys = Object.keys(parsed.state).sort();
    expect(stateKeys).toEqual([
      'demos',
      'lanModeEnabled',
      'scores',
      'sessionDate',
      'skippedDemoIds',
      'windowSeconds',
    ]);

    // subject and logoUrl live inside demos[0], not at the top level
    expect(parsed.state.demos[0].subject).toBe('Acme Corp');
    expect(parsed.state.demos[0].logoUrl).toBe('data:...');
  });

  it('clearSession sets demos to [] (metadata implicitly cleared)', () => {
    useAppStore.getState().addDemo('Alpha');
    const id = useAppStore.getState().demos[0].id;
    useAppStore.getState().updateDemoMeta(id, { subject: 'My App', logoUrl: 'data:...' });
    expect(useAppStore.getState().demos).toHaveLength(1);

    useAppStore.getState().clearSession();

    expect(useAppStore.getState().demos).toEqual([]);
  });
});

describe('Phase 4: partialize invariant — Phase 4 transients excluded', () => {
  it('persists windowSeconds, sessionDate, demos, scores, skippedDemoIds, lanModeEnabled (Phase 8)', () => {
    // Set Phase 4 transients to non-defaults to be certain they don't bleed.
    useAppStore.getState().setMeasurePhase('measuring');
    useAppStore.getState().setProjectorConnected(true);
    useAppStore.setState({ revealActive: true, revealWinner: { name: 'X' } });
    // Add a demo to ensure there's something to persist.
    useAppStore.getState().addDemo('Alpha');

    // Wait for the persist middleware to flush. Zustand persist writes
    // synchronously by default; reading is immediate.
    const raw = localStorage.getItem('noisium:state');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    const persistedKeys = Object.keys(parsed.state).sort();
    expect(persistedKeys).toEqual([
      'demos',
      'lanModeEnabled',
      'scores',
      'sessionDate',
      'skippedDemoIds',
      'windowSeconds',
    ]);
    // Explicitly confirm the Phase 4 fields are absent
    expect(parsed.state).not.toHaveProperty('measurePhase');
    expect(parsed.state).not.toHaveProperty('revealActive');
    expect(parsed.state).not.toHaveProperty('revealWinner');
    expect(parsed.state).not.toHaveProperty('projectorConnected');
    // Phase 8 transient is absent too
    expect(parsed.state).not.toHaveProperty('wsConnectionStatus');
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 8: lanModeEnabled + wsConnectionStatus
// ─────────────────────────────────────────────────────────────

describe('useAppStore — Phase 8 defaults', () => {
  it('lanModeEnabled defaults to false', () => {
    expect(useAppStore.getState().lanModeEnabled).toBe(false);
  });

  it('wsConnectionStatus defaults to "idle"', () => {
    expect(useAppStore.getState().wsConnectionStatus).toBe('idle');
  });
});

describe('useAppStore — setLanModeEnabled', () => {
  it('sets lanModeEnabled to true', () => {
    useAppStore.getState().setLanModeEnabled(true);
    expect(useAppStore.getState().lanModeEnabled).toBe(true);
  });

  it('sets lanModeEnabled to false', () => {
    useAppStore.getState().setLanModeEnabled(true);
    useAppStore.getState().setLanModeEnabled(false);
    expect(useAppStore.getState().lanModeEnabled).toBe(false);
  });
});

describe('useAppStore — setWsConnectionStatus', () => {
  it('sets wsConnectionStatus to "waiting"', () => {
    useAppStore.getState().setWsConnectionStatus('waiting');
    expect(useAppStore.getState().wsConnectionStatus).toBe('waiting');
  });

  it('sets wsConnectionStatus to "connected"', () => {
    useAppStore.getState().setWsConnectionStatus('connected');
    expect(useAppStore.getState().wsConnectionStatus).toBe('connected');
  });

  it('sets wsConnectionStatus to "disconnected"', () => {
    useAppStore.getState().setWsConnectionStatus('disconnected');
    expect(useAppStore.getState().wsConnectionStatus).toBe('disconnected');
  });

  it('sets wsConnectionStatus to "reconnecting"', () => {
    useAppStore.getState().setWsConnectionStatus('reconnecting');
    expect(useAppStore.getState().wsConnectionStatus).toBe('reconnecting');
  });
});

describe('Phase 8: partialize includes lanModeEnabled, excludes wsConnectionStatus', () => {
  it('lanModeEnabled is in the persisted keys', () => {
    useAppStore.getState().setLanModeEnabled(true);
    const raw = localStorage.getItem('noisium:state');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toHaveProperty('lanModeEnabled', true);
  });

  it('wsConnectionStatus is NOT in the persisted keys', () => {
    useAppStore.getState().setWsConnectionStatus('connected');
    const raw = localStorage.getItem('noisium:state');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).not.toHaveProperty('wsConnectionStatus');
  });

  it('persisted keys include lanModeEnabled alongside existing keys', () => {
    useAppStore.getState().setLanModeEnabled(true);
    const raw = localStorage.getItem('noisium:state');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    const persistedKeys = Object.keys(parsed.state).sort();
    expect(persistedKeys).toEqual([
      'demos',
      'lanModeEnabled',
      'scores',
      'sessionDate',
      'skippedDemoIds',
      'windowSeconds',
    ]);
  });
});

describe('Phase 8: clearSession does NOT reset lanModeEnabled', () => {
  it('lanModeEnabled survives clearSession', () => {
    useAppStore.getState().setLanModeEnabled(true);
    useAppStore.getState().clearSession();
    expect(useAppStore.getState().lanModeEnabled).toBe(true);
  });
});
