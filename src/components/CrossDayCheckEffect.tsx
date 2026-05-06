import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { todayLocalISO } from '../lib/date';

export function CrossDayCheckEffect() {
  const sessionDate = useAppStore((s) => s.sessionDate);
  const crossDayPromptShown = useAppStore((s) => s.crossDayPromptShown);
  const setCrossDayPromptShown = useAppStore((s) => s.setCrossDayPromptShown);

  useEffect(() => {
    // Already showing or already dismissed this load — do nothing.
    if (crossDayPromptShown) return;
    if (!sessionDate) return; // first-ever load (no persisted date) — no prompt
    const today = todayLocalISO();
    if (sessionDate !== today) {
      setCrossDayPromptShown(true);
    }
  }, [sessionDate, crossDayPromptShown, setCrossDayPromptShown]);

  return null;
}
