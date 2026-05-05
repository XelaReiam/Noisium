import { vi, beforeEach } from 'vitest';

// -- AudioContext mock (overridable per test via vi.mocked) ----
class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 48000;
  destination = {} as AudioDestinationNode;
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createMediaStreamSource = vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
  }));
  createAnalyser = vi.fn().mockImplementation(() => ({
    fftSize: 2048,
    smoothingTimeConstant: 0,
    getFloatTimeDomainData: vi.fn(),
    connect: vi.fn(),
  }));
  createGain = vi.fn().mockImplementation(() => ({
    gain: { value: 0 },
    connect: vi.fn(),
  }));
}
// @ts-expect-error — assigning the mock to the global
globalThis.AudioContext = MockAudioContext;

// -- navigator.mediaDevices mock ----
Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// -- navigator.permissions mock ----
Object.defineProperty(globalThis.navigator, 'permissions', {
  value: {
    query: vi.fn().mockRejectedValue(new Error('not implemented in test by default')),
  },
  writable: true,
  configurable: true,
});

// -- requestAnimationFrame stub (jsdom has it but it doesn't tick) ----
// Tests that need a tick should call vi.advanceTimersByTime() or invoke the
// raf callback directly via vi.mocked.

// Reset between tests so vi.fn() call counts don't leak
beforeEach(() => {
  vi.clearAllMocks();
});
