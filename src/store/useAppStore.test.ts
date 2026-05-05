import { describe, it, expect, beforeEach } from 'vitest';
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
    expect(stateKeys).toEqual([
      'demos',
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
