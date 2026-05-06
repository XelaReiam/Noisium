import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTransport, getEffectiveMode, type TransportMode } from '../lib/transport';
import {
  deriveProjectorMessage,
  type ProjectorMessageState,
} from '../lib/projector';

const HEARTBEAT_INTERVAL_MS = 2000;

/**
 * Render-null host-side transport relay. Mounted once in HostView
 * alongside CrossDayCheckEffect and MeasurementOrchestrator.
 *
 * Three responsibilities:
 *
 * 1. SUBSCRIBE TO STORE → derive ProjectorMessage → post (deduplicated)
 *    Uses useAppStore.subscribe() (not a selector) so we react only to
 *    actual store updates, not re-renders. Dedupe via lastSentRef so e.g.
 *    a demo rename doesn't re-broadcast the same `{ phase: 'idle' }` message.
 *
 * 2. LISTEN for projector replies:
 *    - `{ phase: 'request-state' }` → re-broadcast current derived message
 *      (PROJ-04 — newly opened projector tab snaps to current state)
 *    - `{ phase: 'heartbeat-projector' }` → call refreshProjectorHeartbeat,
 *      which sets projectorConnected=true and schedules the 5s staleness timer
 *
 * 3. POST `{ phase: 'heartbeat-host' }` every 2s so the projector's optional
 *    "host alive" awareness can work.
 *
 * Transport selection:
 *    - lanModeEnabled=false → BroadcastChannelTransport (same-device mode)
 *    - lanModeEnabled=true  → WebSocketTransport (LAN mode via CLI relay)
 *
 * When WS mode is active, wsConnectionStatus is driven from WS lifecycle:
 *    - On effect entry (WS transport created): 'waiting'
 *    - On WS onopen: 'connected'
 *    - On WS onclose: 'disconnected'
 *
 * CRITICAL: transport.close() is NOT called in cleanup — the factory owns
 * the singleton lifecycle. Cleanup only removes listeners and clears timers.
 */
export function BroadcastBridge() {
  const lastSentRef = useRef<string>('');

  const lanModeEnabled = useAppStore((s) => s.lanModeEnabled);
  const setWsConnectionStatus = useAppStore((s) => s.setWsConnectionStatus);

  // Derive the current mode string — used as a dependency so the effect
  // re-runs when the user toggles LAN mode (TRANS-04 requirement).
  const mode: TransportMode = lanModeEnabled ? 'websocket' : 'broadcast';
  const effectiveMode = getEffectiveMode(mode);

  useEffect(() => {
    // Capture transport in a local const (pitfall 2: cleanup must reference
    // this exact instance, not call getTransport() again).
    const transport = getTransport(mode);

    function pickProjectorState(): ProjectorMessageState {
      const s = useAppStore.getState();
      return {
        demos: s.demos,
        measuringDemoId: s.measuringDemoId,
        measurePhase: s.measurePhase,
        windowSeconds: s.windowSeconds,
        revealActive: s.revealActive,
        revealWinner: s.revealWinner,
      };
    }

    function broadcastIfChanged(force = false): void {
      const msg = deriveProjectorMessage(pickProjectorState());
      const serialized = JSON.stringify(msg);
      if (!force && serialized === lastSentRef.current) return;
      lastSentRef.current = serialized;
      transport.postMessage(msg);
    }

    // --- WS lifecycle hooks (only in websocket mode) ---
    if (effectiveMode === 'websocket') {
      setWsConnectionStatus('waiting');
      // Access the underlying WebSocket instance to attach lifecycle hooks.
      // We use the internal _ws field (as any) since WebSocketTransport does
      // not expose an onStatusChange callback. This is the accepted approach
      // per plan research open question 2 when onStatusChange isn't implemented.
      const wsTransport = transport as unknown as { _ws?: WebSocket };
      if (wsTransport._ws) {
        const ws = wsTransport._ws;
        ws.onopen = () => {
          setWsConnectionStatus('connected');
        };
        ws.onclose = () => {
          const prior = useAppStore.getState().wsConnectionStatus;
          setWsConnectionStatus(prior === 'connected' ? 'reconnecting' : 'disconnected');
        };
      }
    }

    // 1. Initial broadcast — gives a freshly-mounted host a baseline send.
    broadcastIfChanged(true);

    // 2. Subscribe to ALL store changes — derive + send on each.
    const unsub = useAppStore.subscribe(() => {
      broadcastIfChanged();
    });

    // 3. Listen for projector replies on the transport.
    function handleIncoming(event: MessageEvent<unknown>): void {
      const data = event.data as { phase?: string };
      if (!data || typeof data.phase !== 'string') return;

      if (data.phase === 'request-state') {
        // PROJ-04: a freshly-opened (or reopened) projector tab is asking
        // for the current phase. Force-resend, bypassing dedup.
        broadcastIfChanged(true);
        return;
      }

      if (data.phase === 'heartbeat-projector') {
        useAppStore.getState().refreshProjectorHeartbeat();
        return;
      }

      // Anything else is ignored.
    }
    transport.addEventListener('message', handleIncoming);

    // 4. Heartbeat sender.
    const heartbeatId = window.setInterval(() => {
      transport.postMessage({ phase: 'heartbeat-host' });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      unsub();
      transport.removeEventListener('message', handleIncoming);
      clearInterval(heartbeatId);
      // NOTE: do NOT call transport.close() — factory owns lifecycle.
    };
  }, [effectiveMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
