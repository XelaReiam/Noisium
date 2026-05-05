interface Props {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Inline warning that REPLACES the CountdownOverlay's content during an
 * aborted measurement. Per CONTEXT decision: "big inline warning REPLACES
 * countdown overlay; 'Measurement aborted — audio interrupted. [Retry]'"
 *
 * The clickable backdrop area dismisses the warning (CONTEXT.md: "Click
 * anywhere else → warning dismisses, demo row goes back to Pending").
 *
 * Pure presentation. Receives the message + callbacks; renders the JSX.
 */
export function AbortWarning({ message, onRetry, onDismiss }: Props) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="abort-warning-message"
      className="absolute inset-0 z-10 bg-white/95 flex flex-col items-center justify-center gap-6 p-8"
      onClick={onDismiss}
    >
      <div
        className="flex flex-col items-center gap-4"
        // Stop propagation so clicking inside the inner card doesn't trigger
        // onDismiss — only clicks on the backdrop dismiss.
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="abort-warning-message"
          className="text-2xl font-medium text-amber-900 text-center max-w-md"
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-2 rounded bg-amber-700 text-white font-medium hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          autoFocus
        >
          Retry
        </button>
        <p className="text-xs text-gray-500 mt-4">
          Click anywhere outside this card to dismiss.
        </p>
      </div>
    </div>
  );
}
