import { clsx } from 'clsx';
import type { DemoStatus } from '../lib/measurement';

interface Props {
  status: DemoStatus;
}

const LABELS: Record<DemoStatus, string> = {
  pending: 'Pending',
  measuring: 'Measuring',
  measured: 'Measured',
  skipped: 'Skipped',
  aborted: 'Aborted',
};

const STYLES: Record<DemoStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  // Measuring uses an animated pulse to make the active demo obvious
  measuring: 'bg-blue-100 text-blue-800 animate-pulse',
  measured: 'bg-green-100 text-green-800',
  skipped: 'bg-gray-100 text-gray-500 line-through',
  aborted: 'bg-amber-100 text-amber-800',
};

/**
 * Status badge for a demo card. Pure presentation — takes one prop and
 * renders the corresponding Tailwind pill.
 *
 * Used by DemoCard. Status is derived from store state via getDemoStatus
 * inside the parent — this component does not read the store.
 */
export function DemoStatusBadge({ status }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
