import { describe, it, expect } from 'vitest';
import { buildCsvString, buildCsvFilename } from './exportCsv';
import type { Score } from './measurement';
import type { Demo } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const score = (deltaDb: number): Score => ({
  avgDbFs: -30,
  deltaDb,
  capturedAt: '2026-05-06T00:00:00.000Z',
});

/**
 * Minimal RFC 4180 unquote: if the field starts/ends with `"`, strip outer
 * quotes and unescape `""` → `"`. Otherwise return as-is.
 */
function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

/**
 * Parse a CSV row that may contain quoted fields.
 * Only handles the subset produced by buildCsvString (all string fields quoted,
 * numeric fields unquoted — no commas/quotes inside numeric fields).
 */
function parseRow(row: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < row.length) {
    if (row[i] === '"') {
      // Quoted field
      let j = i + 1;
      while (j < row.length) {
        if (row[j] === '"' && row[j + 1] === '"') {
          j += 2; // escaped quote
        } else if (row[j] === '"') {
          break; // end of quoted field
        } else {
          j++;
        }
      }
      fields.push(unquote(row.slice(i, j + 1)));
      i = j + 2; // skip closing quote + comma
    } else {
      // Unquoted field — read until comma or end
      const end = row.indexOf(',', i);
      if (end === -1) {
        fields.push(row.slice(i));
        break;
      } else {
        fields.push(row.slice(i, end));
        i = end + 1;
      }
    }
  }
  return fields;
}

/** Split CSV string into rows (strips trailing empty line from final \r\n). */
function rows(csv: string): string[] {
  return csv.split('\r\n').filter((r) => r.length > 0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCsvFilename', () => {
  it('returns date-based filename when sessionDate is provided', () => {
    expect(buildCsvFilename('2026-05-06')).toBe('noisium-results-2026-05-06.csv');
  });

  it('returns fallback filename when sessionDate is null', () => {
    expect(buildCsvFilename(null)).toBe('noisium-results.csv');
  });
});

describe('buildCsvString — header', () => {
  it('first row is the exact header', () => {
    const csv = buildCsvString([], {}, []);
    const [header] = rows(csv);
    expect(header).toBe('name,subject,deltaDb,rank,status,winner');
  });

  it('uses CRLF line endings', () => {
    const csv = buildCsvString([], {}, []);
    expect(csv).toMatch(/\r\n/);
    // Should not have bare \n
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('ends with CRLF after last row', () => {
    const csv = buildCsvString([], {}, []);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('buildCsvString — single measured demo', () => {
  const demos: Demo[] = [{ id: 'a', name: 'Alpha' }];

  it('produces exactly 2 rows (header + data)', () => {
    const csv = buildCsvString(demos, { a: score(5.678) }, []);
    expect(rows(csv)).toHaveLength(2);
  });

  it('data row has correct deltaDb (2 dp), rank 1, status measured, winner true', () => {
    const csv = buildCsvString(demos, { a: score(5.678) }, []);
    const data = parseRow(rows(csv)[1]);
    expect(data[0]).toBe('Alpha');     // name
    expect(data[1]).toBe('');          // subject (undefined → empty)
    expect(data[2]).toBe('5.68');      // deltaDb 2 dp
    expect(data[3]).toBe('1');         // rank
    expect(data[4]).toBe('measured');  // status
    expect(data[5]).toBe('true');      // winner
  });
});

describe('buildCsvString — two demos, different scores', () => {
  const demos: Demo[] = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Bravo' },
  ];

  it('winner row has winner=true and rank=1; loser has winner=false and rank=2', () => {
    const csv = buildCsvString(demos, { a: score(8), b: score(12) }, []);
    const dataRows = rows(csv).slice(1).map(parseRow);

    const alphaRow = dataRows.find((r) => r[0] === 'Alpha')!;
    const bravoRow = dataRows.find((r) => r[0] === 'Bravo')!;

    expect(alphaRow[3]).toBe('2');       // rank
    expect(alphaRow[5]).toBe('false');   // winner
    expect(bravoRow[3]).toBe('1');       // rank
    expect(bravoRow[5]).toBe('true');    // winner
  });
});

describe('buildCsvString — tied demos', () => {
  const demos: Demo[] = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Bravo' },
  ];

  it('both get rank 1 and winner=true on a tie', () => {
    const csv = buildCsvString(demos, { a: score(10), b: score(10) }, []);
    const dataRows = rows(csv).slice(1).map(parseRow);

    for (const r of dataRows) {
      expect(r[3]).toBe('1');      // both rank 1
      expect(r[5]).toBe('true');   // both winners
    }
  });

  it('competition rank: 1, 1, 3 for three-way tie in top two', () => {
    const demos3: Demo[] = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
      { id: 'c', name: 'Charlie' },
    ];
    const csv = buildCsvString(
      demos3,
      { a: score(10), b: score(10), c: score(8) },
      [],
    );
    const dataRows = rows(csv).slice(1).map(parseRow);

    const alphaRow = dataRows.find((r) => r[0] === 'Alpha')!;
    const bravoRow = dataRows.find((r) => r[0] === 'Bravo')!;
    const charlieRow = dataRows.find((r) => r[0] === 'Charlie')!;

    expect(alphaRow[3]).toBe('1');
    expect(bravoRow[3]).toBe('1');
    expect(charlieRow[3]).toBe('3'); // skipped rank 2 due to two-way tie at top
    expect(charlieRow[5]).toBe('false');
  });
});

describe('buildCsvString — skipped demo', () => {
  const demos: Demo[] = [{ id: 'a', name: 'Alpha' }];

  it('skipped demo has empty deltaDb, empty rank, status skipped, winner false', () => {
    const csv = buildCsvString(demos, {}, ['a']);
    const data = parseRow(rows(csv)[1]);
    expect(data[0]).toBe('Alpha');
    expect(data[2]).toBe('');        // deltaDb empty
    expect(data[3]).toBe('');        // rank empty
    expect(data[4]).toBe('skipped');
    expect(data[5]).toBe('false');
  });
});

describe('buildCsvString — pending demo', () => {
  const demos: Demo[] = [{ id: 'a', name: 'Alpha' }];

  it('pending demo has empty deltaDb, empty rank, status pending, winner false', () => {
    const csv = buildCsvString(demos, {}, []);
    const data = parseRow(rows(csv)[1]);
    expect(data[0]).toBe('Alpha');
    expect(data[2]).toBe('');        // deltaDb empty
    expect(data[3]).toBe('');        // rank empty
    expect(data[4]).toBe('pending');
    expect(data[5]).toBe('false');
  });
});

describe('buildCsvString — RFC 4180 quoting', () => {
  it('demo name with comma is quoted', () => {
    const demos: Demo[] = [{ id: 'a', name: 'Foo, Bar' }];
    const csv = buildCsvString(demos, { a: score(5) }, []);
    const data = parseRow(rows(csv)[1]);
    expect(data[0]).toBe('Foo, Bar'); // unquoted value
    // raw CSV should contain the double-quoted form
    expect(csv).toContain('"Foo, Bar"');
  });

  it('demo name with double-quote is escaped as "" per RFC 4180', () => {
    const demos: Demo[] = [{ id: 'a', name: 'Say "hello"' }];
    const csv = buildCsvString(demos, { a: score(5) }, []);
    const data = parseRow(rows(csv)[1]);
    expect(data[0]).toBe('Say "hello"'); // round-trips correctly
    expect(csv).toContain('"Say ""hello"""');
  });
});

describe('buildCsvString — subject field', () => {
  it('subject field is populated from demo.subject', () => {
    const demos: Demo[] = [{ id: 'a', name: 'Alpha', subject: 'My App' }];
    const csv = buildCsvString(demos, { a: score(5) }, []);
    const data = parseRow(rows(csv)[1]);
    expect(data[1]).toBe('My App');
  });

  it('subject field is empty string when demo.subject is undefined', () => {
    const demos: Demo[] = [{ id: 'a', name: 'Alpha' }];
    const csv = buildCsvString(demos, { a: score(5) }, []);
    const data = parseRow(rows(csv)[1]);
    expect(data[1]).toBe('');
  });
});
