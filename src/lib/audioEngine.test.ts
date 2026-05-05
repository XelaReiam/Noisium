import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioEngine, type EngineStatus } from './audioEngine';

// -- Helpers ----

function makeFakeTrack(overrides: Partial<{
  label: string;
  settings: MediaTrackSettings;
}> = {}) {
  const stop = vi.fn();
  const track = {
    kind: 'audio' as const,
    label: overrides.label ?? 'Default - Test Mic',
    stop,
    getSettings: vi.fn().mockReturnValue({
      deviceId: 'default',
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
      ...overrides.settings,
    }),
  };
  return track;
}

function makeFakeStream(track: ReturnType<typeof makeFakeTrack>) {
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

let statusEvents: EngineStatus[] = [];
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  statusEvents = [];
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  // Capture rAF callback so the loop only runs when we want it to
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((_cb: FrameRequestCallback) => {
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
  consoleLogSpy.mockRestore();
  vi.unstubAllGlobals();
});

function record(status: EngineStatus) {
  statusEvents.push(status);
}

// -- Tests ----

describe('AudioEngine — construction (CAL-03)', () => {
  it('does NOT create an AudioContext during construction', () => {
    const ctxSpy = vi.spyOn(globalThis, 'AudioContext' as never);
    new AudioEngine(record);
    expect(ctxSpy).not.toHaveBeenCalled();
  });

  it('does NOT call getUserMedia during construction', () => {
    new AudioEngine(record);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});

describe('AudioEngine.requestPermission — happy path (CAL-02 / CAL-03)', () => {
  it('creates AudioContext on first requestPermission call', async () => {
    const ctxSpy = vi.spyOn(globalThis, 'AudioContext' as never);
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    expect(ctxSpy).toHaveBeenCalledTimes(1);
  });

  it('passes all three AGC constraints set to false', async () => {
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    const call = vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls[0][0];
    expect(call?.audio).toMatchObject({
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    });
    expect(call?.video).toBe(false);
  });

  it('emits granted status with deviceId and label', async () => {
    const track = makeFakeTrack({
      label: 'External USB Mic',
      settings: { deviceId: 'usb-mic-id-123' },
    });
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    const last = statusEvents[statusEvents.length - 1];
    expect(last.permission).toBe('granted');
    expect(last.deviceId).toBe('usb-mic-id-123');
    expect(last.deviceLabel).toBe('External USB Mic');
    expect(last.audioReady).toBe(true);
  });
});

describe('AudioEngine.requestPermission — error mapping (SET-03)', () => {
  it('maps NotAllowedError to "denied"', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException('User denied', 'NotAllowedError'),
    );
    const engine = new AudioEngine(record);
    const status = await engine.requestPermission();
    expect(status.permission).toBe('denied');
    expect(status.audioReady).toBe(false);
  });

  it('maps NotFoundError to "missing"', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException('No device', 'NotFoundError'),
    );
    const engine = new AudioEngine(record);
    const status = await engine.requestPermission();
    expect(status.permission).toBe('missing');
  });

  it('maps unknown errors defensively to "denied"', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new Error('Generic failure'),
    );
    const engine = new AudioEngine(record);
    const status = await engine.requestPermission();
    expect(status.permission).toBe('denied');
  });
});

describe('AudioEngine — AGC verification (CAL-02)', () => {
  it('warns when settings.autoGainControl === true', async () => {
    const track = makeFakeTrack({
      settings: {
        autoGainControl: true,
        echoCancellation: false,
        noiseSuppression: false,
      },
    });
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('autoGainControl'),
    );
  });

  it('does NOT warn when settings is empty object (Safari)', async () => {
    const track = makeFakeTrack({ settings: {} });
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});

describe('AudioEngine.setDevice — track stopping (mic-indicator release)', () => {
  it('passes deviceId.exact to getUserMedia', async () => {
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.setDevice('device-xyz');
    const call = vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls[0][0];
    // @ts-expect-error — narrowing
    expect(call.audio.deviceId).toEqual({ exact: 'device-xyz' });
  });

  it('stops prior stream tracks before acquiring new stream', async () => {
    const firstTrack = makeFakeTrack({ label: 'first' });
    const secondTrack = makeFakeTrack({ label: 'second' });
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(makeFakeStream(firstTrack))
      .mockResolvedValueOnce(makeFakeStream(secondTrack));
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    expect(firstTrack.stop).not.toHaveBeenCalled();
    await engine.setDevice('different-device');
    expect(firstTrack.stop).toHaveBeenCalledTimes(1);
  });
});

describe('AudioEngine — lifecycle', () => {
  it('dispose() is idempotent — safe before any grant', () => {
    const engine = new AudioEngine(record);
    expect(() => engine.dispose()).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
    // Should have emitted 'idle' at least once
    expect(statusEvents.some((s) => s.permission === 'idle')).toBe(true);
  });

  it('dispose() after grant stops the stream', async () => {
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    engine.dispose();
    expect(track.stop).toHaveBeenCalled();
    const last = statusEvents[statusEvents.length - 1];
    expect(last.permission).toBe('idle');
  });

  it('markLost() emits "lost" and stops stream', async () => {
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    engine.markLost();
    expect(track.stop).toHaveBeenCalled();
    const last = statusEvents[statusEvents.length - 1];
    expect(last.permission).toBe('lost');
  });

  it('getCurrentLevel() returns 0 before grant', () => {
    const engine = new AudioEngine(record);
    expect(engine.getCurrentLevel()).toBe(0);
  });
});

// -- Additional lifecycle tests for robustness ----

describe('AudioEngine — additional robustness', () => {
  it('does not re-throw on getUserMedia error — caller does not need try/catch', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException('User denied', 'NotAllowedError'),
    );
    const engine = new AudioEngine(record);
    await expect(engine.requestPermission()).resolves.not.toThrow();
  });

  it('requestPermission returns the same status it emits', async () => {
    const track = makeFakeTrack({ label: 'My Mic', settings: { deviceId: 'abc' } });
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    const returnedStatus = await engine.requestPermission();
    const emittedStatus = statusEvents[statusEvents.length - 1];
    expect(returnedStatus).toEqual(emittedStatus);
  });

  it('markLost() sets currentLevel to 0', async () => {
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    engine.markLost();
    expect(engine.getCurrentLevel()).toBe(0);
  });

  it('dispose() emits idle status even after markLost()', async () => {
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    engine.markLost();
    engine.dispose();
    const last = statusEvents[statusEvents.length - 1];
    expect(last.permission).toBe('idle');
  });

  it('AudioContext resume() called when state is not running', async () => {
    const track = makeFakeTrack();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      makeFakeStream(track),
    );
    // Override AudioContext so state starts as 'suspended'
    const resumeMock = vi.fn().mockResolvedValue(undefined);
    class SuspendedAudioContext {
      state: AudioContextState = 'suspended';
      sampleRate = 48000;
      destination = {} as AudioDestinationNode;
      resume = resumeMock;
      close = vi.fn().mockResolvedValue(undefined);
      createMediaStreamSource = vi.fn().mockReturnValue({ connect: vi.fn() });
      createAnalyser = vi.fn().mockReturnValue({
        fftSize: 2048,
        smoothingTimeConstant: 0,
        getFloatTimeDomainData: vi.fn(),
        connect: vi.fn(),
      });
      createGain = vi.fn().mockReturnValue({ gain: { value: 0 }, connect: vi.fn() });
    }
    vi.stubGlobal('AudioContext', SuspendedAudioContext);
    const engine = new AudioEngine(record);
    await engine.requestPermission();
    expect(resumeMock).toHaveBeenCalledTimes(1);
  });
});
