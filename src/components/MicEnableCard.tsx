interface Props {
  /** When true, render the small 'access was lost' subtext beneath the heading. */
  showLostNote?: boolean;
  /** When true, the button is disabled (e.g. while requestPermission() is in flight). */
  disabled?: boolean;
  onEnable: () => void;
}

export function MicEnableCard({ showLostNote, disabled, onEnable }: Props) {
  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Enable microphone</h2>
      <p className="text-gray-600 mb-4">
        Noisium needs microphone access to measure applause.
      </p>
      {showLostNote && (
        <p className="text-sm text-amber-700 mb-4">Microphone access was lost.</p>
      )}
      <button
        type="button"
        onClick={onEnable}
        disabled={disabled}
        className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
      >
        {disabled ? 'Requesting…' : 'Enable microphone'}
      </button>
    </div>
  );
}
