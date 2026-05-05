import { LevelIndicator } from './LevelIndicator';
import { DevicePicker } from './DevicePicker';

interface Props {
  deviceLabel: string;
  activeDeviceId: string | null;
  getLevel: () => number;
  onDeviceChange: (deviceId: string) => void;
  /** Disabled while a setDevice() is in flight. */
  disabled?: boolean;
}

export function MicLivePanel({
  deviceLabel,
  activeDeviceId,
  getLevel,
  onDeviceChange,
  disabled,
}: Props) {
  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Microphone live</h2>
        <p className="text-sm text-gray-600 truncate" title={deviceLabel}>
          {deviceLabel || 'Default input'}
        </p>
      </div>
      <div className="mb-5">
        <LevelIndicator getLevel={getLevel} />
      </div>
      <DevicePicker
        activeDeviceId={activeDeviceId}
        onChange={onDeviceChange}
        disabled={disabled}
      />
    </div>
  );
}
