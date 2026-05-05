import { detectBrowser, recoveryInstructions } from '../lib/detectBrowser';

interface Props {
  /** 'denied' uses NotAllowed copy; 'missing' uses NotFound copy. */
  kind: 'denied' | 'missing';
  disabled?: boolean;
  onTryAgain: () => void;
}

export function MicErrorCard({ kind, disabled, onTryAgain }: Props) {
  const isDenied = kind === 'denied';
  const heading = isDenied ? 'Microphone access denied' : 'No microphone detected';
  // Browser-specific copy only matters for 'denied' (the user must reset the
  // browser permission). For 'missing', generic copy is correct because the
  // fix is at the OS / hardware level.
  const body = isDenied
    ? recoveryInstructions(detectBrowser())
    : 'Connect a microphone and click Try again.';

  return (
    <div
      role="alert"
      className="w-full max-w-md rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold text-red-900 mb-2">{heading}</h2>
      <p className="text-red-800 mb-4">{body}</p>
      <button
        type="button"
        onClick={onTryAgain}
        disabled={disabled}
        className="px-4 py-2 rounded bg-red-900 text-white hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-900 focus:ring-offset-2"
      >
        {disabled ? 'Trying…' : 'Try again'}
      </button>
    </div>
  );
}
