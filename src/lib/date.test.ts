import { describe, expect, it } from 'vitest';
import { todayLocalISO } from './date';

describe('todayLocalISO', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(todayLocalISO(new Date(2026, 4, 6))).toBe('2026-05-06');
  });
});
