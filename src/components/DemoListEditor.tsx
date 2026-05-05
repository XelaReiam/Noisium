import { useState } from 'react';
import { clsx } from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { DemoCard } from './DemoCard';

interface Props {
  /** Provided by Plan 03-05's HostView wiring. Undefined = Measure buttons are disabled-no-op. */
  onMeasure?: (demoId: string) => void;
  /** True when calibration not yet completed (calibrationAmbientDb === null). */
  calibrationMissing: boolean;
}

/**
 * The demo list editor. Lives in HostView's settings section, beside the
 * WindowPicker. Always editable per CONTEXT decision (even mid-show — known
 * tradeoff). Empty list shows a placeholder.
 *
 * Reorder UX: up/down arrow buttons (NOT HTML5 drag-and-drop). RESEARCH
 * recommended this for the Friday deadline — 3x less code; no drag-image
 * setup; no dragover preventDefault in every drop zone.
 *
 * Layout:
 *   <h2>Demos</h2>
 *   [card 1] [up down]
 *   [card 2] [up down]
 *   ...
 *   [+ input]              [Add]
 */
export function DemoListEditor({ onMeasure, calibrationMissing }: Props) {
  const demos = useAppStore((s) => s.demos);
  const measuringDemoId = useAppStore((s) => s.measuringDemoId);
  const addDemo = useAppStore((s) => s.addDemo);
  const moveDemo = useAppStore((s) => s.moveDemo);

  const [pendingName, setPendingName] = useState('');

  // While ANY measurement is running, freeze the editor — preventing edits to
  // demos[] mid-window prevents the rare race where the measuring demo is
  // removed between sample N and sample N+1. Also matches CONTEXT.md decision
  // ("rest of UI grayed/disabled during measurement").
  const globallyDisabled = measuringDemoId !== null;

  const disabledMeasureHelper = calibrationMissing ? 'Calibrate room first' : '';
  const disabledMeasure = calibrationMissing || globallyDisabled;

  function handleAdd(): void {
    const trimmed = pendingName.trim();
    if (!trimmed) return;
    addDemo(trimmed);
    setPendingName('');
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <section
      aria-labelledby="demos-heading"
      className="w-full max-w-md flex flex-col gap-2"
    >
      <h2 id="demos-heading" className="text-sm font-medium text-gray-700">
        Demos
      </h2>

      {/* Empty-state placeholder */}
      {demos.length === 0 && (
        <p className="text-sm text-gray-400 italic px-3 py-4 border border-dashed border-gray-200 rounded">
          Add your first demo to start.
        </p>
      )}

      {/* Demo cards with reorder controls */}
      {demos.map((demo, idx) => (
        <div key={demo.id} className="flex items-stretch gap-2">
          <div className="flex-1 min-w-0">
            <DemoCard
              demo={demo}
              onMeasure={onMeasure}
              disabledMeasure={disabledMeasure}
              disabledMeasureHelper={disabledMeasureHelper}
              globallyDisabled={globallyDisabled}
            />
          </div>
          {/* Reorder buttons stacked to the right of the card */}
          <div
            className={clsx(
              'flex flex-col gap-0.5',
              globallyDisabled && 'opacity-50 pointer-events-none',
            )}
          >
            <button
              type="button"
              onClick={() => moveDemo(demo.id, 'up')}
              disabled={idx === 0}
              aria-label={`Move ${demo.name} up`}
              className={clsx(
                'w-8 h-8 rounded text-sm flex items-center justify-center',
                idx === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {/* Up arrow */}
              &#9650;
            </button>
            <button
              type="button"
              onClick={() => moveDemo(demo.id, 'down')}
              disabled={idx === demos.length - 1}
              aria-label={`Move ${demo.name} down`}
              className={clsx(
                'w-8 h-8 rounded text-sm flex items-center justify-center',
                idx === demos.length - 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {/* Down arrow */}
              &#9660;
            </button>
          </div>
        </div>
      ))}

      {/* Add row */}
      <div
        className={clsx(
          'flex items-center gap-2 mt-1',
          globallyDisabled && 'opacity-50 pointer-events-none',
        )}
      >
        <input
          type="text"
          value={pendingName}
          onChange={(e) => setPendingName(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Demo name"
          aria-label="New demo name"
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!pendingName.trim()}
          className={clsx(
            'px-3 py-2 rounded text-sm font-medium',
            pendingName.trim()
              ? 'bg-gray-900 text-white hover:bg-gray-800'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          )}
        >
          + Add
        </button>
      </div>
    </section>
  );
}
