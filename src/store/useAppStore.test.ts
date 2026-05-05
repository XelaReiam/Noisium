import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

// Reset store between tests by setting all fields back to defaults
beforeEach(() => {
  useAppStore.setState({
    windowSeconds: 8,
    sessionDate: '2026-05-05',
    persistenceWorking: true,
    crossDayPromptShown: false,
    micPermission: 'idle',
    micDeviceId: null,
    audioReady: false,
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

describe('useAppStore — partialize invariant', () => {
  it('localStorage payload contains ONLY windowSeconds and sessionDate', () => {
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
    expect(stateKeys).toEqual(['sessionDate', 'windowSeconds']);
    // Transient fields MUST NOT leak into storage
    expect(parsed.state).not.toHaveProperty('micPermission');
    expect(parsed.state).not.toHaveProperty('micDeviceId');
    expect(parsed.state).not.toHaveProperty('audioReady');
    expect(parsed.state).not.toHaveProperty('persistenceWorking');
    expect(parsed.state).not.toHaveProperty('crossDayPromptShown');
  });
});
