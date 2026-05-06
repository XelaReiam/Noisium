import { useAppStore } from '../store/useAppStore';
import { canRevealWinner } from '../lib/projector';
import { buildCsvString, buildCsvFilename, triggerDownload } from '../lib/exportCsv';

/**
 * Self-contained button that reads store state and triggers a CSV download.
 * Renders null when canRevealWinner is false — no external gate needed.
 */
export function DownloadCsvButton() {
  const demos = useAppStore((s) => s.demos);
  const scores = useAppStore((s) => s.scores);
  const skippedDemoIds = useAppStore((s) => s.skippedDemoIds);
  const sessionDate = useAppStore((s) => s.sessionDate);

  const canReveal = canRevealWinner(demos, scores, skippedDemoIds);
  if (!canReveal) return null;

  const handleClick = () => {
    const csv = buildCsvString(demos, scores, skippedDemoIds);
    const filename = buildCsvFilename(sessionDate);
    triggerDownload(csv, filename);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-6 py-3 rounded text-base font-semibold transition-colors bg-gray-900 text-white hover:bg-gray-800"
    >
      Download CSV
    </button>
  );
}
