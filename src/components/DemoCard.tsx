import React from 'react';
import { clsx } from 'clsx';
import { useAppStore, type Demo, type Score } from '../store/useAppStore';
import { getDemoStatus, getNormalizedScore } from '../lib/measurement';
import { DemoStatusBadge } from './DemoStatusBadge';

interface Props {
  demo: Demo;
  /**
   * Click handler for the Measure button. Provided by Plan 03-05's
   * HostView wiring. When undefined OR `disabledMeasure` is true, the
   * Measure button renders disabled.
   *
   * Why a prop and not direct store call: Plan 03-05 owns the measurement
   * orchestration (countdown overlay, AbortController, calibration gate
   * check, etc.). Wrapping the click here would couple this component to
   * audio orchestration — exactly what we're avoiding.
   */
  onMeasure?: (demoId: string) => void;
  /** True when calibration not yet completed OR a measurement is already running. */
  disabledMeasure: boolean;
  /** Helper text shown next to a disabled Measure button (e.g. "Calibrate room first"). Empty string = no text. */
  disabledMeasureHelper?: string;
  /** Disables ALL controls on the card while ANY measurement is in progress (Plan 03-05 sets this true while measuringDemoId !== null). */
  globallyDisabled: boolean;
}

function formatDelta(deltaDb: number): string {
  const sign = deltaDb > 0 ? '+' : deltaDb < 0 ? '−' : ''; // unicode minus for negative
  const abs = Math.abs(deltaDb).toFixed(1);
  return `${sign}${abs} dB`;
}

/**
 * Per-demo card. Renders status badge + name + score (when measured) +
 * action buttons (Measure / Skip / Redo / Unskip / Remove).
 *
 * Phase 3 score view shows BOTH formats side-by-side per CONTEXT decision:
 *   - delta-dB: stable, never recomputes ("+12.4 dB")
 *   - normalized 0-100: dynamic, shifts as louder demos land
 *
 * Layout:
 *   [Status badge] Demo name                     [x]
 *   [Delta dB] [0-100]   [Measure] [Skip] [Redo]
 *
 * In redo-confirm state, the action row is replaced by:
 *   "Redo measurement for {name}? [Redo] [Cancel]"
 */
export function DemoCard({
  demo,
  onMeasure,
  disabledMeasure,
  disabledMeasureHelper,
  globallyDisabled,
}: Props) {
  // Selectors — narrow to minimize re-renders
  const measuringDemoId = useAppStore((s) => s.measuringDemoId);
  const abortedDemoId = useAppStore((s) => s.abortedDemoId);
  const scores = useAppStore((s) => s.scores);
  const skippedDemoIds = useAppStore((s) => s.skippedDemoIds);
  const redoConfirmDemoId = useAppStore((s) => s.redoConfirmDemoId);

  // Actions
  const skipDemo = useAppStore((s) => s.skipDemo);
  const unskipDemo = useAppStore((s) => s.unskipDemo);
  const requestRedo = useAppStore((s) => s.requestRedo);
  const cancelRedo = useAppStore((s) => s.cancelRedo);
  const confirmRedo = useAppStore((s) => s.confirmRedo);
  const removeDemo = useAppStore((s) => s.removeDemo);
  const renameDemo = useAppStore((s) => s.renameDemo);
  const updateDemoMeta = useAppStore((s) => s.updateDemoMeta);

  const [logoError, setLogoError] = React.useState<string | null>(null);

  const status = getDemoStatus(demo.id, measuringDemoId, abortedDemoId, scores, skippedDemoIds);
  const score: Score | undefined = scores[demo.id];

  // Compute normalized 0-100 against the loudest delta seen so far.
  // Math.max with a floor of 0 prevents -Infinity from an empty spread.
  const maxDeltaDb = Math.max(0, ...Object.values(scores).map((s) => s.deltaDb));
  const normalized = score ? getNormalizedScore(score.deltaDb, maxDeltaDb) : 0;

  const isRedoConfirm = redoConfirmDemoId === demo.id;

  // Disable everything except the redo confirm bar's own buttons when global disable is on
  // (the confirm bar is owned by THIS card and should still respond to its own buttons,
  // but during measurement nothing should be clickable). globallyDisabled wins.
  const baseDisabled = globallyDisabled;

  function handleSubjectBlur(e: React.FocusEvent<HTMLInputElement>): void {
    const next = e.currentTarget.value;
    updateDemoMeta(demo.id, { subject: next.trim() || undefined });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      setLogoError('Logo must be under 200 KB');
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      updateDemoMeta(demo.id, { logoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  function handleRenameBlur(e: React.FocusEvent<HTMLInputElement>): void {
    const next = e.currentTarget.value;
    if (next.trim() !== demo.name) {
      renameDemo(demo.id, next);
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // triggers the blur handler
    }
  }

  return (
    <div
      className={clsx(
        'border border-gray-200 rounded-lg p-3 bg-white',
        baseDisabled && 'opacity-50 pointer-events-none',
      )}
    >
      {/* Header row: badge + name input + remove */}
      <div className="flex items-center gap-2">
        <DemoStatusBadge status={status} />
        <input
          type="text"
          defaultValue={demo.name}
          onBlur={handleRenameBlur}
          onKeyDown={handleRenameKeyDown}
          aria-label={`Demo name (${demo.name})`}
          className={clsx(
            'flex-1 min-w-0 px-2 py-1 text-sm bg-transparent',
            'border-b border-transparent hover:border-gray-200 focus:border-gray-400',
            'focus:outline-none',
            status === 'skipped' && 'line-through text-gray-500',
          )}
        />
        <button
          type="button"
          onClick={() => removeDemo(demo.id)}
          aria-label={`Remove ${demo.name}`}
          className="text-gray-400 hover:text-red-600 px-1 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Metadata row: subject + logo — always visible, disabled during measurement */}
      <div className="flex items-center gap-3 mt-2">
        <input
          type="text"
          defaultValue={demo.subject ?? ''}
          onBlur={handleSubjectBlur}
          placeholder="Subject (e.g. app name)"
          aria-label={`Subject for ${demo.name}`}
          className="flex-1 min-w-0 px-2 py-1 text-xs bg-transparent border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none text-gray-600"
        />
        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0">
          Logo
          <input
            key={demo.logoUrl ?? 'empty'}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="sr-only"
            aria-label={`Upload logo for ${demo.name}`}
          />
        </label>
        {demo.logoUrl && (
          <img
            src={demo.logoUrl}
            alt={`${demo.name} logo preview`}
            className="h-6 w-6 object-contain rounded"
          />
        )}
        {logoError && (
          <span className="text-xs text-red-600">{logoError}</span>
        )}
      </div>

      {/* Score row + action row */}
      {isRedoConfirm ? (
        <div className="flex items-center gap-3 text-sm mt-2 p-2 bg-amber-50 rounded">
          <span className="text-gray-700 flex-1">
            Redo measurement for {demo.name}?
          </span>
          <button
            type="button"
            onClick={() => confirmRedo(demo.id)}
            className="text-amber-800 font-medium hover:text-amber-900 px-2 py-1"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={cancelRedo}
            className="text-gray-600 hover:text-gray-900 px-2 py-1"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 mt-2">
          {/* Score display — only when measured */}
          {score && (
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-mono text-gray-900 tabular-nums">
                {formatDelta(score.deltaDb)}
              </span>
              <span className="text-gray-500 tabular-nums">{normalized}/100</span>
            </div>
          )}
          {!score && status === 'pending' && (
            <span className="text-xs text-gray-400">Not measured</span>
          )}

          {/* Spacer pushes actions right */}
          <div className="flex-1" />

          {/* Actions */}
          {/* Measure button: shown for pending demos. Disabled if calibration missing OR measurement in progress. */}
          {status === 'pending' && (
            <div className="flex items-center gap-2">
              {disabledMeasureHelper && disabledMeasure && (
                <span className="text-xs text-gray-500">{disabledMeasureHelper}</span>
              )}
              <button
                type="button"
                onClick={onMeasure ? () => onMeasure(demo.id) : undefined}
                disabled={disabledMeasure}
                className={clsx(
                  'px-3 py-1 rounded text-sm font-medium',
                  disabledMeasure
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800',
                )}
              >
                Measure
              </button>
            </div>
          )}

          {/* Skip / Unskip toggle — available for pending and measured (skip overrides; CONTEXT.md: undoable) */}
          {status === 'pending' && (
            <button
              type="button"
              onClick={() => skipDemo(demo.id)}
              className="px-3 py-1 rounded text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Skip
            </button>
          )}
          {status === 'skipped' && (
            <button
              type="button"
              onClick={() => unskipDemo(demo.id)}
              className="px-3 py-1 rounded text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Unskip
            </button>
          )}

          {/* Redo — only for measured demos */}
          {status === 'measured' && (
            <button
              type="button"
              onClick={() => requestRedo(demo.id)}
              className="px-3 py-1 rounded text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Redo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
