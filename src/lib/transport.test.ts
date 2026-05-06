import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTransport, resetNoisiumTransport } from './transport';
import { getNoisiumChannel, resetNoisiumChannel } from './broadcastChannel';

// MockWebSocket is installed on globalThis.WebSocket by src/test/setup.ts.
// We cast to access test helpers (_simulateOpen, _simulateMessage, _simulateClose).
type MockWS = {
  url: string;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen: ((e: Event) => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  onclose: ((e: CloseEvent) => void) | null;
  _simulateOpen(): void;
  _simulateMessage(data: unknown): void;
  _simulateClose(code?: number): void;
};

// Track every WebSocket instance created during a test.
let wsInstances: MockWS[] = [];

beforeEach(() => {
  // Reset transport + broadcast channel singletons between tests.
  resetNoisiumTransport();
  resetNoisiumChannel();
  wsInstances = [];

  // Wrap globalThis.WebSocket so we can capture each new instance.
  const OriginalWS = globalThis.WebSocket;
  // @ts-expect-error — replacing global with tracking wrapper
  globalThis.WebSocket = function TrackingWebSocket(url: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance = new (OriginalWS as any)(url) as MockWS;
    wsInstances.push(instance);
    return instance;
  };
  // Copy static constants so `WebSocket.OPEN` etc. still work in transport.ts.
  const ws = globalThis.WebSocket as unknown as Record<string, unknown>;
  ws['OPEN'] = 1;
  ws['CONNECTING'] = 0;
  ws['CLOSING'] = 2;
  ws['CLOSED'] = 3;
});

function lastWs(): MockWS {
  return wsInstances[wsInstances.length - 1];
}

// Helper: access the underlying BroadcastChannel mock with type helpers
function getMockBc() {
  return getNoisiumChannel() as unknown as {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    _simulateMessage(d: unknown): void;
  };
}

// ─────────────────────────────────────────────────────────────
// BroadcastChannelTransport
// ─────────────────────────────────────────────────────────────

describe('getTransport("broadcast") — singleton', () => {
  it('returns the same instance on second call', () => {
    const t1 = getTransport('broadcast');
    const t2 = getTransport('broadcast');
    expect(t1).toBe(t2);
  });
});

describe('BroadcastChannelTransport — postMessage', () => {
  it('delegates to BroadcastChannel.postMessage', () => {
    const t = getTransport('broadcast');
    const bc = getMockBc();
    const data = { type: 'ping' };
    t.postMessage(data);
    expect(bc.postMessage).toHaveBeenCalledWith(data);
  });
});

describe('BroadcastChannelTransport — addEventListener', () => {
  it('registers listener and delivers messages', () => {
    const t = getTransport('broadcast');
    const bc = getMockBc();
    const received: unknown[] = [];
    const listener = (e: MessageEvent) => received.push(e.data);
    t.addEventListener('message', listener);
    bc._simulateMessage({ type: 'hello' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'hello' });
  });
});

describe('BroadcastChannelTransport — removeEventListener', () => {
  it('stops delivering messages after removal', () => {
    const t = getTransport('broadcast');
    const bc = getMockBc();
    const received: unknown[] = [];
    const listener = (e: MessageEvent) => received.push(e.data);
    t.addEventListener('message', listener);
    t.removeEventListener('message', listener);
    bc._simulateMessage({ type: 'should-not-arrive' });
    expect(received).toHaveLength(0);
  });
});

describe('BroadcastChannelTransport — close', () => {
  it('calls BroadcastChannel.close()', () => {
    const t = getTransport('broadcast');
    const bc = getMockBc();
    t.close();
    expect(bc.close).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────
// WebSocketTransport
// ─────────────────────────────────────────────────────────────

describe('getTransport("websocket") — singleton', () => {
  it('returns the same instance on second call', () => {
    const t1 = getTransport('websocket');
    const t2 = getTransport('websocket');
    expect(t1).toBe(t2);
  });
});

describe('WebSocketTransport — URL derivation', () => {
  it('uses ws:// when protocol is http:', () => {
    // jsdom uses http: by default
    expect(window.location.protocol).toBe('http:');
    getTransport('websocket');
    const ws = lastWs();
    expect(ws.url).toMatch(/^ws:\/\//);
    expect(ws.url).toBe(`ws://${window.location.host}`);
  });
});

describe('WebSocketTransport — postMessage', () => {
  it('does NOT call ws.send when readyState is CONNECTING (default)', () => {
    const t = getTransport('websocket');
    t.postMessage({ type: 'test' });
    const ws = lastWs();
    // readyState starts CONNECTING = 0
    expect(ws.readyState).toBe(0); // CONNECTING
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('calls ws.send(JSON.stringify(data)) when readyState is OPEN', () => {
    const t = getTransport('websocket');
    const ws = lastWs();
    ws._simulateOpen();
    expect(ws.readyState).toBe(1); // OPEN
    const data = { type: 'test-open', value: 99 };
    t.postMessage(data);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(data));
  });
});

describe('WebSocketTransport — incoming message', () => {
  it('fires listener with MessageEvent whose data is the parsed object', () => {
    const t = getTransport('websocket');
    const ws = lastWs();
    const received: unknown[] = [];
    const listener = (e: MessageEvent) => received.push(e.data);
    t.addEventListener('message', listener);
    const payload = { type: 'projector', value: 42 };
    ws._simulateMessage(payload); // mock JSON.stringifies internally
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(payload); // transport should have parsed back to object
  });
});

describe('WebSocketTransport — removeEventListener', () => {
  it('stops delivering messages after removeEventListener', () => {
    const t = getTransport('websocket');
    const ws = lastWs();
    const received: unknown[] = [];
    const listener = (e: MessageEvent) => received.push(e.data);
    t.addEventListener('message', listener);
    t.removeEventListener('message', listener);
    ws._simulateMessage({ type: 'should-not-arrive' });
    expect(received).toHaveLength(0);
  });
});

describe('WebSocketTransport — close', () => {
  it('calls ws.close() — readyState becomes CLOSED', () => {
    const t = getTransport('websocket');
    const ws = lastWs();
    // Spy on the close method before calling transport.close()
    const closeSpy = vi.spyOn(ws, 'close');
    t.close();
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────
// Mode switching
// ─────────────────────────────────────────────────────────────

describe('mode switching — broadcast → websocket', () => {
  it('closes the broadcast transport and returns a new WS-backed instance', () => {
    const bc = getTransport('broadcast');
    const closeSpy = vi.spyOn(bc, 'close');
    const ws = getTransport('websocket');
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(ws).not.toBe(bc);
  });
});

describe('mode switching — websocket → broadcast', () => {
  it('closes the WS transport and returns a new BC-backed instance', () => {
    const ws = getTransport('websocket');
    const closeSpy = vi.spyOn(ws, 'close');
    const bc = getTransport('broadcast');
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(bc).not.toBe(ws);
  });
});

// ─────────────────────────────────────────────────────────────
// resetNoisiumTransport
// ─────────────────────────────────────────────────────────────

describe('resetNoisiumTransport', () => {
  it('after reset, getTransport("broadcast") creates a fresh instance', () => {
    const t1 = getTransport('broadcast');
    resetNoisiumTransport();
    const t2 = getTransport('broadcast');
    expect(t2).not.toBe(t1);
  });

  it('after reset, getTransport("websocket") creates a fresh instance', () => {
    const t1 = getTransport('websocket');
    resetNoisiumTransport();
    const t2 = getTransport('websocket');
    expect(t2).not.toBe(t1);
  });
});
