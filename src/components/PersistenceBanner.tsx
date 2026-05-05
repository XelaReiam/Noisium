import { useAppStore } from '../store/useAppStore';

export function PersistenceBanner() {
  const persistenceWorking = useAppStore((s) => s.persistenceWorking);
  if (persistenceWorking) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-sm text-center"
    >
      State won&apos;t survive a refresh — keep this tab open.
    </div>
  );
}
