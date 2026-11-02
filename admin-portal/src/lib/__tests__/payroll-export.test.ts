import { buildPayrollCsv, csvEscape, formatCompletedTime, isValidDate, mapPayrollRows, UTF8_BOM } from '../payroll-export';

describe('payroll-export', () => {
  const jobs = [
    {
      id: 'j2', scheduled_date: '2026-10-06', updated_at: '2026-10-06T20:00:00Z', technician_id: 't2',
      technician: { full_name: 'Zoe Ríos' },
      property: { customer_name: 'Pérez, Ana', address: '123 Main St', city: 'Davie', state: 'FL', zip: '33328' },
      reports: [{ departure_time: '2026-10-06T15:30:00Z', is_deleted: false }],
    },
    {
      id: 'j1', scheduled_date: '2026-10-05', technician_id: 't1',
      technician: [{ full_name: 'Al Smith' }],
      property: [{ customer_name: 'Bob', address: '9 Elm', city: null, state: null, zip: null }],
      reports: [],
      updated_at: '2026-10-05T18:00:00Z',
    },
    { id: 'j3', scheduled_date: '2026-10-05', technician_id: null, reports: [] },
  ];

  it('maps, drops unassigned, sorts by tech then date', () => {
    const rows = mapPayrollRows(jobs);
    expect(rows.map((r) => r.technicianName)).toEqual(['Al Smith', 'Zoe Ríos']);
    expect(rows[1].address).toBe('123 Main St, Davie, FL 33328');
    expect(rows[1].completedAt).toBe('2026-10-06T15:30:00Z');
    expect(rows[0].completedAt).toBe('2026-10-05T18:00:00Z');
  });

  it('formats completed time in zone', () => {
    expect(formatCompletedTime('2026-10-06T15:30:00Z', 'America/Chicago')).toBe('2026-10-06 10:30');
    expect(formatCompletedTime(null)).toBe('');
  });

  it('escapes CSV and neutralizes formulas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)");
  });

  it('builds BOM CSV with CRLF and summary', () => {
    const csv = buildPayrollCsv(mapPayrollRows(jobs), [{ technicianId: 't1', fullName: 'Al Smith', completed: 1 }]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Technician,Date,Customer,Address,Completed Time');
    expect(lines[2]).toContain('"Pérez, Ana"');
    expect(lines).toContain('Technician,Completed Pools');
    expect(lines).toContain('Al Smith,1');
  });

  it('validates dates', () => {
    expect(isValidDate('2026-10-01')).toBe(true);
    expect(isValidDate('2026-1-01')).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});
