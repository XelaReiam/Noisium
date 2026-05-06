import { vi, beforeEach } from 'vitest';

// -- AudioContext mock (overridable per test via vi.mocked) ----
class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 48000;
  destination = {} as AudioDestinationNode;
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
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

// -- WebSocket mock (jsdom does not implement WebSocket) ----
// Tests verify sends by spying on `send` and trigger receives via `_simulateMessage`.
// readyState transitions: CONNECTING (0) on construct → OPEN (1) via _simulateOpen → CLOSED (3) via close()/_simulateClose.
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private _listeners = new Map<string, Set<EventListener>>();

  send = vi.fn();

  constructor(url: string) {
    this.url = url;
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new Event('close');
    this._listeners.get('close')?.forEach((l) => l(event));
    this.onclose?.(event as CloseEvent);
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  /** Test helper: simulate the WebSocket connection opening. */
  _simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    const event = new Event('open');
    this._listeners.get('open')?.forEach((l) => l(event));
    this.onopen?.(event);
  }

  /** Test helper: simulate an incoming message (data is JSON-stringified automatically). */
  _simulateMessage(data: unknown): void {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    this._listeners.get('message')?.forEach((l) => l(event));
    this.onmessage?.(event);
  }

  /** Test helper: simulate the WebSocket closing with a code. */
  _simulateClose(code: number = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent('close', { code });
    this._listeners.get('close')?.forEach((l) => l(event));
    this.onclose?.(event);
  }
}
// @ts-expect-error — assigning the mock to the global
globalThis.WebSocket = MockWebSocket;

// -- BroadcastChannel mock (jsdom 29 does not implement it) ----
// In tests, messages between separate channel instances are NOT delivered cross-instance —
// tests verify sends by spying on `postMessage` and trigger receives via `_simulateMessage`.
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private _listeners = new Map<string, Set<EventListener>>();

  constructor(name: string) {
    this.name = name;
  }

  postMessage = vi.fn();
  close = vi.fn();

  addEventListener(type: string, listener: EventListener): void {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  /** Test helper: pretend a message arrived on the channel. */
  _simulateMessage(data: unknown): void {
    const event = new MessageEvent('message', { data });
    this._listeners.get('message')?.forEach((l) => l(event));
    this.onmessage?.(event);
  }
}
// @ts-expect-error — assigning the mock to the global
globalThis.BroadcastChannel = MockBroadcastChannel;

// Reset between tests so vi.fn() call counts don't leak
beforeEach(() => {
  vi.clearAllMocks();
});
