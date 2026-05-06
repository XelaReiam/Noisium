import { useEffect, useState } from 'react';

interface Props {
  /** Initial countdown value sent by the host. The component counts down locally. */
  countdownSeconds: number;
}

/**
 * Renders a full-screen 3→2→1 countdown that drives off a local 1000ms timer.
 *
 * Why the projector counts down locally instead of waiting for new messages
 * per tick: BroadcastChannel within the same browser is sub-millisecond, but
 * a local timer eliminates ANY dependency on message-frequency. Per 04-RESEARCH
 * Open Question 1, the host sends ONCE at countdown start and the projector
 * times out the rest. If a new message (e.g. measuring) arrives mid-countdown,
 * the parent ProjectorView unmounts this component, clearing the timer naturally.
 */
export function ProjectorCountdown({ countdownSeconds }: Props) {
  const [value, setValue] = useState<number>(countdownSeconds);

  useEffect(() => {
    // Reset to the initial value whenever it changes (e.g. a fresh countdown
    // for a new demo). Then tick every 1000ms.
    setValue(countdownSeconds);
    const intervalId = window.setInterval(() => {
      setValue((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [countdownSeconds]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span
        aria-live="assertive"
        className="text-9xl font-black tabular-nums text-gray-900"
      >
        {value}
      </span>
    </div>
  );
}
