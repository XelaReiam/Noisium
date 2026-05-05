import { useEffect, useState } from 'react';

interface Props {
  /** The currently active deviceId (from store). Falls back to '' for the default option. */
  activeDeviceId: string | null;
  onChange: (deviceId: string) => void;
  disabled?: boolean;
}

export function DevicePicker({ activeDeviceId, onChange, disabled }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  async function refresh(): Promise<void> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === 'audioinput'));
    } catch {
      setDevices([]);
    }
  }

  useEffect(() => {
    void refresh();
    const handler = () => {
      void refresh();
    };
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handler);
    };
  }, []);

  return (
    <label className="block text-sm">
      <span className="text-gray-700 mb-1 block">Input device</span>
      <select
        value={activeDeviceId ?? ''}
        // Re-enumerate when the dropdown opens — catches devices plugged in
        // without firing devicechange (rare but cheap insurance)
        onClick={() => {
          void refresh();
        }}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || devices.length === 0}
        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 disabled:opacity-50"
      >
        {devices.length === 0 && (
          <option value="">No microphone found</option>
        )}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone (${d.deviceId.slice(0, 6)}…)`}
          </option>
        ))}
      </select>
    </label>
  );
}
