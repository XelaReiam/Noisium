import { useEffect, useRef, useState } from 'react';
import { getTransport, resetNoisiumTransport, type TransportMode } from '../lib/transport';
import { useAppStore } from '../store/useAppStore';
import type { ProjectorMessage } from '../lib/projector';
import { ProjectorIdle } from './ProjectorIdle';
import { ProjectorCountdown } from './ProjectorCountdown';
import { ProjectorSuspense } from './ProjectorSuspense';
import { ProjectorReveal } from './ProjectorReveal';

const HEARTBEAT_INTERVAL_MS = 2000;
const REVEAL_BUILDUP_MS = 2500;
const WINDOW_END_DISPLAY_MS = 1200;

type RevealDisplayPhase = 'buildup' | 'name';

/**
 * Reachable at #/projector. Subscribes to the noisium transport (broadcast or
 * WebSocket depending on lanModeEnabled), renders the right screen for each
 * ProjectorMessage variant, and owns the local timers for the reveal
 * buildup→name transition and the window-end auto-fade to idle.
 *
 * TRANS-02: When lanModeEnabled=false (broadcast mode), behaviour is identical
 * to v1.1 — BroadcastChannel messages flow through unmodified.
 *
 * CONN-04: When lanModeEnabled=true (websocket mode), reconnects automatically
 * with exponential backoff: 1s, 2s, 4s, ... capped at 30s. Delay resets to
 * 1s after a successful open.
 *
 * StrictMode safety: getTransport() is a module-level singleton, so double-
 * mounted effects share one transport instance and only duplicate effect calls
 * (e.g. two `request-state` posts) which the host handles idempotently.
 *
 * NOTE: ProjectorView reads lanModeEnabled from useAppStore. lanModeEnabled is
 * persisted to localStorage so the projector tab (opened via window.open) shares
 * the same preference as the host tab.
 *
 * PROJ-04: posts `request-state` on mount so a freshly-opened projector
 * snaps to the host's current phase on the next host action (heartbeat or
 * a state change re-broadcast triggered by the host's BroadcastBridge).
 */
export function ProjectorView() {
  const [message, setMessage] = useState<ProjectorMessage>({ phase: 'idle' });
  const [revealDisplay, setRevealDisplay] = useState<RevealDisplayPhase>('buildup');
  // showWindowEnd: while true, render ProjectorIdle with cornerStatus="Thank you."
  // After WINDOW_END_DISPLAY_MS, auto-transitions to plain idle.
  const [showWindowEnd, setShowWindowEnd] = useState<{ demoName: string } | null>(null);

  // WS reconnect state
  const [retryCount, setRetryCount] = useState(0);
  const retryDelayRef = useRef(1000);
  const retryTimerRef = useRef<number | null>(null);

  // Refs for cancellable timers
  const revealTimerRef = useRef<number | null>(null);
  const windowEndTimerRef = useRef<number | null>(null);

  const lanModeEnabled = useAppStore((s) => s.lanModeEnabled);
  const mode: TransportMode = lanModeEnabled ? 'websocket' : 'broadcast';

  useEffect(() => {
    const transport = getTransport(mode);

    function clearRevealTimer(): void {
      if (revealTimerRef.current !== null) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    }

    function clearWindowEndTimer(): void {
      if (windowEndTimerRef.current !== null) {
        clearTimeout(windowEndTimerRef.current);
        windowEndTimerRef.current = null;
      }
    }

    function handleMessage(event: MessageEvent<unknown>): void {
      const data = event.data as { phase?: string };
      if (!data || typeof data.phase !== 'string') return;

      // heartbeat-host: silently absorb. Don't update visible state.
      if (data.phase === 'heartbeat-host') return;

      // Cancel any pending timers — a new message overrides them.
      // This is critical for Test 13: an incoming message during reveal
      // buildup must abort the pending name transition.
      clearRevealTimer();
      clearWindowEndTimer();
      setShowWindowEnd(null);

      const msg = event.data as ProjectorMessage;

      if (msg.phase === 'reveal') {
        setMessage(msg);
        setRevealDisplay('buildup');
        revealTimerRef.current = window.setTimeout(() => {
          setRevealDisplay('name');
          revealTimerRef.current = null;
        }, REVEAL_BUILDUP_MS);
        return;
      }

      if (msg.phase === 'window-end') {
        // Don't store window-end as the message — instead set a transient
        // window-end overlay state, then auto-transition to idle after
        // WINDOW_END_DISPLAY_MS.
        setShowWindowEnd({ demoName: msg.demoName });
        windowEndTimerRef.current = window.setTimeout(() => {
          setShowWindowEnd(null);
          setMessage({ phase: 'idle' });
          windowEndTimerRef.current = null;
        }, WINDOW_END_DISPLAY_MS);
        // We also store the message so the render still routes to idle
        // (since window-end has its own UI but transitions to idle).
        setMessage({ phase: 'idle' });
        return;
      }

      setMessage(msg);
    }

    transport.addEventListener('message', handleMessage);

    // PROJ-04: request the current state from the host on mount.
    transport.postMessage({ phase: 'request-state' });

    // Heartbeat sender — fires every 2s while mounted.
    const heartbeatId = window.setInterval(() => {
      transport.postMessage({ phase: 'heartbeat-projector' });
    }, HEARTBEAT_INTERVAL_MS);

    // WS-mode reconnect with exponential backoff (CONN-04).
    // Only attach lifecycle listeners in websocket mode.
    if (mode === 'websocket') {
      // Access the underlying WebSocket via the transport to attach open/close.
      // WebSocketTransport does not expose onStatusChange, so we cast.
      const wsTransport = transport as unknown as {
        _ws: WebSocket;
      };

      function scheduleReconnect(): void {
        retryTimerRef.current = window.setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
          resetNoisiumTransport();
          setRetryCount((n) => n + 1);
        }, retryDelayRef.current);
      }

      wsTransport._ws.onopen = () => {
        retryDelayRef.current = 1000;
      };

      wsTransport._ws.onclose = () => {
        scheduleReconnect();
      };
    }

    return () => {
      transport.removeEventListener('message', handleMessage);
      clearInterval(heartbeatId);
      clearRevealTimer();
      clearWindowEndTimer();
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // Do NOT call transport.close() — the factory owns the lifecycle.
    };
  }, [mode, retryCount]);

  // Render switch — drives off message.phase, with the windowEnd overlay
  // taking precedence over plain idle.
  if (showWindowEnd) {
    return <ProjectorIdle cornerStatus="Thank you." />;
  }

  switch (message.phase) {
    case 'idle':
      return <ProjectorIdle />;
    case 'calibrating':
      return <ProjectorIdle cornerStatus="Setting up…" />;
    case 'countdown':
      return <ProjectorCountdown countdownSeconds={message.countdownSeconds} />;
    case 'measuring': {
      const { demoName, remainingSeconds, demoSubject, demoLogoUrl } = message;
      return (
        <ProjectorSuspense
          demoName={demoName}
          remainingSeconds={remainingSeconds}
          demoSubject={demoSubject}
          demoLogoUrl={demoLogoUrl}
        />
      );
    }
    case 'reveal-buildup':
      // Projector-internal variant. Render the idle screen as a safe fallback —
      // this variant is only used internally and the host never posts it.
      return <ProjectorIdle />;
    case 'reveal':
      return (
        <ProjectorReveal
          winner={message.winner}
          displayPhase={revealDisplay}
        />
      );
    case 'window-end':
    case 'heartbeat-host':
      // Already handled above (window-end via showWindowEnd, heartbeat absorbed)
      return <ProjectorIdle />;
    default: {
      // Exhaustive check — TS will complain if a new variant is added without
      // a case here.
      const _exhaustive: never = message;
      void _exhaustive;
      return <ProjectorIdle />;
    }
  }
}
