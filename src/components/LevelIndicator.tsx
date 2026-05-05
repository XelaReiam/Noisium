import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

const CELL_COUNT = 12;

/**
 * RMS-to-cell-count transform. Math.sqrt compresses the bottom-heavy linear
 * RMS scale (raw RMS 0.02 for normal speech would be invisible at 2% of the
 * bar). Multiplier 2.5 picked so quiet speech ≈ 4 cells, normal applause ≈
 * 8-9 cells, near-clip ≈ 11-12 cells. Tune visually if needed.
 */
function rmsToCells(rms: number): number {
  const normalised = Math.min(Math.sqrt(rms) * 2.5, 1);
  return Math.round(normalised * CELL_COUNT);
}

function cellColor(cellIndex: number, litCells: number): string {
  if (cellIndex >= litCells) return 'bg-gray-200';
  // Zone by cell position (not by RMS): cells 0-6 green, 7-9 yellow, 10-11 red
  if (cellIndex >= 10) return 'bg-red-500';
  if (cellIndex >= 7) return 'bg-yellow-400';
  return 'bg-green-500';
}

function cellHeight(cellIndex: number): string {
  // Variable heights produce a "stair-stepped VU" feel
  if (cellIndex < 4) return 'h-4';
  if (cellIndex < 8) return 'h-6';
  return 'h-8';
}

interface Props {
  /** Returns current RMS in [0, 1]. Plan 02-04 wires this to engine.getCurrentLevel(). */
  getLevel: () => number;
}

export function LevelIndicator({ getLevel }: Props) {
  const [litCells, setLitCells] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (): void => {
      const rms = getLevel();
      const cells = rmsToCells(rms);
      // Only call setState if the cell count actually changed — avoids
      // ~60 needless reconciliations per second when sitting in silence
      setLitCells((prev) => (prev === cells ? prev : cells));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [getLevel]);

  return (
    <div
      role="meter"
      aria-label="Microphone level"
      aria-valuemin={0}
      aria-valuemax={CELL_COUNT}
      aria-valuenow={litCells}
      className="flex gap-1 items-end h-8"
    >
      {Array.from({ length: CELL_COUNT }, (_, i) => (
        <div
          key={i}
          className={clsx(
            'flex-1 rounded-sm transition-colors duration-75',
            cellHeight(i),
            cellColor(i, litCells),
          )}
        />
      ))}
    </div>
  );
}
