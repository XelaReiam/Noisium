import type { AudioEngine } from './audioEngine';

/**
 * Wire two paths of permission/device loss detection.
 *
 * Path 1: navigator.permissions.query({ name: 'microphone' }) onchange
 *   - Baseline (2022) widely available in Chrome/Edge/Firefox 118+
 *   - Safari has incomplete permissions.query for microphone — feature-detect
 *   - On state !== 'granted' → engine.markLost()
 *
 * Path 2: navigator.mediaDevices.addEventListener('devicechange', ...)
 *   - Catches USB unplug, OS routing changes, Bluetooth pair/unpair
 *   - On change, if active device is no longer in audioinput list → engine.markLost()
 *
 * Returns a cleanup that removes both listeners (no leaks across StrictMode
 * double-mount).
 *
 * @param engine the AudioEngine to notify on loss
 * @param getActiveDeviceId a getter (not a captured value) so the helper
 *        sees current id after device switches
 */
export async function wirePermissionLoss(
  engine: AudioEngine,
  getActiveDeviceId: () => string | null,
): Promise<() => void> {
  const cleanups: Array<() => void> = [];

  // Path 1: permissions.query — feature-detect, fall back silently on failure
  try {
    const perm = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    const onChange = (): void => {
      if (perm.state !== 'granted') {
        engine.markLost();
      }
    };
    perm.addEventListener('change', onChange);
    cleanups.push(() => perm.removeEventListener('change', onChange));
  } catch {
    // Browser doesn't support querying microphone permission (Safari, older FF).
    // Degrade silently — devicechange path still catches hardware/OS changes.
  }

  // Path 2: devicechange — present in all four target browsers since 2018
  const onDeviceChange = async (): Promise<void> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const activeId = getActiveDeviceId();
      if (activeId === null) return; // nothing to compare; ignore
      const stillPresent = devices.some(
        (d) => d.kind === 'audioinput' && d.deviceId === activeId,
      );
      if (!stillPresent) {
        engine.markLost();
      }
    } catch {
      // enumerateDevices can throw if mediaDevices is unavailable.
      // Defensively ignore — engine remains in granted state.
    }
  };
  navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
  cleanups.push(() =>
    navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange),
  );

  return () => cleanups.forEach((fn) => fn());
}
