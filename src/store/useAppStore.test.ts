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
    // Phase 3 — these properties may not yet exist on the store at this commit;
    // Plan 03-02 adds them. setState with extra keys is a no-op until then.
    demos: [],
    scores: {},
    skippedDemoIds: [],
    calibrationAmbientDb: null,
    measuringDemoId: null,
    abortedDemoId: null,
    abortMessage: null,
    redoConfirmDemoId: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
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
