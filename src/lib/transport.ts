/**
 * Pluggable NoisiumTransport interface + adapters.
 *
 * Two adapters are provided:
 *   - BroadcastChannelTransport: wraps the module-level BroadcastChannel singleton
 *     (getNoisiumChannel). Used for same-device tab communication.
 *   - WebSocketTransport: wraps a native WebSocket to a local CLI relay server.
 *     Used for cross-device LAN mode.
 *
 * A module-level factory (`getTransport`) owns the singleton lifecycle.
 * Components and hooks call getTransport(mode) — they never call close() themselves.
 *
 * Anti-patterns to avoid (per Phase 8 research):
 *   - Do NOT call transport.close() in useEffect cleanup — factory owns lifecycle.
 *   - Do NOT create a new BroadcastChannel inside BroadcastChannelTransport — always
 *     use getNoisiumChannel() to share the existing singleton.
 */

import { getNoisiumChannel } from './broadcastChannel';

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

export type TransportMode = 'broadcast' | 'websocket';

export interface NoisiumTransport {
  postMessage(data: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
}

// ─────────────────────────────────────────────────────────────
// BroadcastChannelTransport
// ─────────────────────────────────────────────────────────────

export class BroadcastChannelTransport implements NoisiumTransport {
  private readonly _bc: BroadcastChannel;

  constructor() {
    this._bc = getNoisiumChannel();
  }

  postMessage(data: unknown): void {
    this._bc.postMessage(data);
  }

  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    this._bc.addEventListener(type, listener as EventListener);
  }

  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    this._bc.removeEventListener(type, listener as EventListener);
  }

  close(): void {
    this._bc.close();
  }
}

// ─────────────────────────────────────────────────────────────
// WebSocketTransport
// ─────────────────────────────────────────────────────────────

export class WebSocketTransport implements NoisiumTransport {
  private readonly _ws: WebSocket;
  private readonly _listeners = new Set<(e: MessageEvent) => void>();

  constructor() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}`;
    this._ws = new WebSocket(url);

    this._ws.onmessage = (rawEvent: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawEvent.data as string);
      } catch {
        parsed = rawEvent.data;
      }
      const dispatchEvent = new MessageEvent('message', { data: parsed });
      this._listeners.forEach((l) => l(dispatchEvent));
    };
  }

  postMessage(data: unknown): void {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
    // Silently drops message when not OPEN (CONNECTING, CLOSING, CLOSED).
    // Callers should check wsConnectionStatus before sending.
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this._listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this._listeners.delete(listener);
  }

  close(): void {
    this._ws.close();
  }
}

// ─────────────────────────────────────────────────────────────
// Module-level singleton factory
// ─────────────────────────────────────────────────────────────

let _transport: NoisiumTransport | null = null;
let _currentMode: TransportMode | null = null;

/**
 * Returns the current transport singleton for the given mode.
 * If the mode differs from the current one, the existing transport is closed
 * and a fresh instance is created.
 */
export function getTransport(mode: TransportMode): NoisiumTransport {
  if (_transport !== null && _currentMode === mode) {
    return _transport;
  }
  _transport?.close();
  _transport = mode === 'broadcast'
    ? new BroadcastChannelTransport()
    : new WebSocketTransport();
  _currentMode = mode;
  return _transport;
}

/**
 * Tears down the singleton. Test-only — resets the factory state so the next
 * getTransport() call creates a fresh instance.
 *
 * @internal
 */
export function resetNoisiumTransport(): void {
  _transport?.close();
  _transport = null;
  _currentMode = null;
}
