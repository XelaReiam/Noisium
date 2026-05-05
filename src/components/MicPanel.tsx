import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { wirePermissionLoss } from '../lib/permissionLoss';
import { MicEnableCard } from './MicEnableCard';
import { MicErrorCard } from './MicErrorCard';
import { MicLivePanel } from './MicLivePanel';

/**
 * Top-level mic UI. Owns the engine ref via useAudioEngine and switches
 * between Enable / Error / Live based on store.micPermission.
 *
 * Card transforms in place — no route change. Same DOM location for all
 * three states, just different content.
 *
 * AudioContext is created INSIDE handleEnable / handleTryAgain because
 * those run inside the user-gesture click handler (CAL-03). Constructing
 * the engine in useAudioEngine is safe — that code path does NOT touch
 * AudioContext (verified by AudioEngine constructor tests in 02-02).
 */
export function MicPanel() {
  const engineRef = useAudioEngine();
  const micPermission = useAppStore((s) => s.micPermission);
  const micDeviceId = useAppStore((s) => s.micDeviceId);
  // Local 'requesting' UI state — separate from the engine's status callback
  // because the click handler is awaiting requestPermission() resolution.
  const [pending, setPending] = useState(false);
  // Cached deviceLabel — set on grant, persists in MicLivePanel header
  const [deviceLabel, setDeviceLabel] = useState<string>('');

  // Derived: a stable getter the LevelIndicator can call from rAF
  const getLevelRef = useRef<() => number>(() => 0);
  getLevelRef.current = () => engineRef.current?.getCurrentLevel() ?? 0;
  const getLevel = (): number => getLevelRef.current();

  async function handleEnable(): Promise<void> {
    if (pending) return;
    setPending(true);
    try {
      const status = await engineRef.current?.requestPermission();
      if (status?.permission === 'granted') {
        setDeviceLabel(status.deviceLabel ?? '');
      } else {
        setDeviceLabel('');
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDeviceChange(deviceId: string): Promise<void> {
    if (pending) return;
    setPending(true);
    try {
      const status = await engineRef.current?.setDevice(deviceId);
      if (status?.permission === 'granted') {
        setDeviceLabel(status.deviceLabel ?? '');
      }
    } finally {
      setPending(false);
    }
  }

  // Wire permission-loss listeners ONLY after grant. The dependency on
  // micPermission means: when state moves to 'granted', the effect runs;
  // when it moves away (lost / idle / dispose), cleanup runs.
  useEffect(() => {
    if (micPermission !== 'granted') return;
    if (!engineRef.current) return;
    const engine = engineRef.current;
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    void wirePermissionLoss(engine, () => useAppStore.getState().micDeviceId).then(
      (cleanupFn) => {
        if (cancelled) {
          cleanupFn();
        } else {
          cleanup = cleanupFn;
        }
      },
    );
    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micPermission]);

  // Cross-day "Start fresh" handler tears down the engine. We register a
  // window-level callback the modal can invoke. Cleaner than coupling the
  // store to engine instances.
  useEffect(() => {
    const dispose = (): void => {
      engineRef.current?.dispose();
    };
    // @ts-expect-error — attaching to window for a single cross-component bridge
    window.__noisiumDisposeEngine = dispose;
    return () => {
      // @ts-expect-error — cleanup of the bridge
      delete window.__noisiumDisposeEngine;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render switch
  if (micPermission === 'idle') {
    return <MicEnableCard onEnable={handleEnable} disabled={pending} />;
  }
  if (micPermission === 'lost') {
    return <MicEnableCard onEnable={handleEnable} disabled={pending} showLostNote />;
  }
  if (micPermission === 'denied') {
    return <MicErrorCard kind="denied" onTryAgain={handleEnable} disabled={pending} />;
  }
  if (micPermission === 'missing') {
    return <MicErrorCard kind="missing" onTryAgain={handleEnable} disabled={pending} />;
  }
  if (micPermission === 'granted') {
    return (
      <MicLivePanel
        deviceLabel={deviceLabel}
        activeDeviceId={micDeviceId}
        getLevel={getLevel}
        onDeviceChange={handleDeviceChange}
        disabled={pending}
      />
    );
  }
  // 'requesting' — engine is mid-call. We're already showing the disabled
  // state via `pending`, so the previous card stays visible. Render the
  // Enable card disabled to avoid a flicker.
  return <MicEnableCard onEnable={handleEnable} disabled />;
}
