import clsx from 'clsx';
import { useAppStore, type WindowSeconds } from '../store/useAppStore';

const OPTIONS: WindowSeconds[] = [5, 8, 10];

export function WindowPicker() {
  const windowSeconds = useAppStore((s) => s.windowSeconds);
  const setWindowSeconds = useAppStore((s) => s.setWindowSeconds);

  return (
    <div
      role="group"
      aria-label="Measurement window length"
      className="inline-flex rounded-full bg-gray-100 p-1 gap-1"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => setWindowSeconds(opt)}
          aria-pressed={windowSeconds === opt}
          className={clsx(
            'rounded-full px-4 py-1 text-sm font-medium transition-colors',
            windowSeconds === opt
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {opt}s
        </button>
      ))}
    </div>
  );
}
