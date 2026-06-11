import { describe, it, expect } from 'vitest';
import '../src/features/insights/forecast-math.js';

const FM = globalThis.ForecastMath;
const NOW = new Date(2026, 5, 15); // 2026-06-15

const inc = (date, amount, recurring = false) => ({ date, type: 'income', amount, recurring });
const exp = (date, amount, recurring = false) => ({ date, type: 'expense', amount, recurring });

describe('addMonths', () => {
  it('adds and subtracts across year boundaries', () => {
    expect(FM.addMonths('2026-01', -1)).toBe('2025-12');
    expect(FM.addMonths('2025-12', 1)).toBe('2026-01');
    expect(FM.addMonths('2026-06', 6)).toBe('2026-12');
  });
});

describe('buildHistory', () => {
  it('returns empty array for no transactions', () => {
    expect(FM.buildHistory([], { now: NOW })).toEqual([]);
  });

  it('accumulates net flow month by month', () => {
    const txs = [inc('2026-04-01', 1000), exp('2026-04-10', 300), inc('2026-05-01', 1000), exp('2026-06-05', 200)];
    const h = FM.buildHistory(txs, { now: NOW });
    expect(h[h.length - 3]).toEqual({ ym: '2026-04', value: 700 });
    expect(h[h.length - 2]).toEqual({ ym: '2026-05', value: 1700 });
    expect(h[h.length - 1]).toEqual({ ym: '2026-06', value: 1500 });
  });

  it('carries value through months without transactions', () => {
    const txs = [inc('2026-02-01', 500)];
    const h = FM.buildHistory(txs, { now: NOW });
    expect(h.map(p => p.value)).toEqual([500, 500, 500, 500, 500]); // Feb..Jun
  });

  it('limits window to the requested number of months', () => {
    const txs = [inc('2024-01-01', 100), inc('2026-06-01', 50)];
    const h = FM.buildHistory(txs, { months: 12, now: NOW });
    expect(h.length).toBe(12);
    expect(h[0].ym).toBe('2025-07');
    expect(h[0].value).toBe(100); // pre-window flow still counted
    expect(h[11]).toEqual({ ym: '2026-06', value: 150 });
  });
});

describe('monthlyFlow', () => {
  it('combines recurring net with trailing 3-month non-recurring average', () => {
    const txs = [
      inc('2026-06-01', 8000, true),  // recurring salary this month
      exp('2026-06-02', 1000, true),  // recurring subscription
      exp('2026-03-10', 600), exp('2026-04-10', 300), exp('2026-05-10', 300),
    ];
    // recurring: +7000; non-recurring avg over Mar-May: -(600+300+300)/3 = -400
    expect(FM.monthlyFlow(txs, { now: NOW })).toBe(6600);
  });

  it('averages over fewer months when history is shorter', () => {
    const txs = [exp('2026-05-10', 300)];
    expect(FM.monthlyFlow(txs, { now: NOW })).toBe(-300);
  });

  it('is zero with no data', () => {
    expect(FM.monthlyFlow([], { now: NOW })).toBe(0);
  });
});

describe('project', () => {
  it('returns null with less than one full month of history', () => {
    expect(FM.project([], { now: NOW })).toBeNull();
    expect(FM.project([inc('2026-06-01', 100)], { now: NOW })).toBeNull();
  });

  it('projects forward from the last history point', () => {
    const txs = [inc('2026-04-01', 1000), inc('2026-05-01', 1000), inc('2026-06-01', 1000)];
    const r = FM.project(txs, { horizon: 6, now: NOW });
    expect(r).not.toBeNull();
    const last = r.history[r.history.length - 1];
    expect(last).toEqual({ ym: '2026-06', value: 3000 });
    expect(r.monthlyFlow).toBe(1000); // avg of Apr+May (+Mar window clipped)
    expect(r.projection.length).toBe(6);
    expect(r.projection[0]).toEqual({ ym: '2026-07', value: 4000 });
    expect(r.projection[5]).toEqual({ ym: '2026-12', value: 9000 });
  });

  it('handles negative flows', () => {
    const txs = [exp('2026-04-20', 400), exp('2026-05-10', 400)];
    const r = FM.project(txs, { horizon: 3, now: NOW });
    expect(r.monthlyFlow).toBeLessThan(0);
    expect(r.projection[2].value).toBeLessThan(r.history[r.history.length - 1].value);
  });
});
