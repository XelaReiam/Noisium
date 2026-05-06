import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getNoisiumChannel } from '../lib/broadcastChannel';
import {
  deriveProjectorMessage,
  type ProjectorMessageState,
} from '../lib/projector';

const HEARTBEAT_INTERVAL_MS = 2000;

/**
 * Render-null host-side BroadcastChannel relay. Mounted once in HostView
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
 *    "host alive" awareness can work (we don't currently render anything off
 *    this on the projector, but the message is part of the locked union).
 *
 * Pattern matches CrossDayCheckEffect: render-null component, all logic in
 * a single useEffect with a clean cleanup path.
 */
export function BroadcastBridge() {
  const lastSentRef = useRef<string>('');

  useEffect(() => {
    const channel = getNoisiumChannel();

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
      channel.postMessage(msg);
    }

    // 1. Initial broadcast — gives a freshly-mounted host a baseline send so
    //    the projector receives at least one message even if no state change
    //    follows immediately.
    broadcastIfChanged(true);

    // 2. Subscribe to ALL store changes — derive + send on each.
    const unsub = useAppStore.subscribe(() => {
      broadcastIfChanged();
    });

    // 3. Listen for projector replies on the channel.
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

      // Anything else — including our own heartbeat-host echo — is ignored.
    }
    channel.addEventListener('message', handleIncoming);

    // 4. Heartbeat sender.
    const heartbeatId = window.setInterval(() => {
      channel.postMessage({ phase: 'heartbeat-host' });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      unsub();
      channel.removeEventListener('message', handleIncoming);
      clearInterval(heartbeatId);
    };
  }, []);

  return null;
}
