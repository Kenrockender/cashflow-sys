import { describe, it, expect } from 'vitest';

// Mirror the updated fingerprint from store.js
function txSyncFingerprint(t) {
  const amt = Number(t.amount);
  const cat = t.category || '';
  const acct = t.accountId || '';
  return `${t.date}|${amt}|${String(t.description || '').trim().toLowerCase()}|${cat}|${acct}`;
}

describe('txSyncFingerprint', () => {
  it('produces a deterministic fingerprint', () => {
    const tx = { date: '2026-01-15', amount: 50000, description: 'Coffee', category: 'food', accountId: 'main' };
    expect(txSyncFingerprint(tx)).toBe('2026-01-15|50000|coffee|food|main');
  });

  it('differentiates by category', () => {
    const base = { date: '2026-01-15', amount: 50000, description: 'Coffee' };
    expect(txSyncFingerprint({ ...base, category: 'food' }))
      .not.toBe(txSyncFingerprint({ ...base, category: 'social' }));
  });

  it('differentiates by accountId', () => {
    const base = { date: '2026-01-15', amount: 50000, description: 'Coffee', category: 'food' };
    expect(txSyncFingerprint({ ...base, accountId: 'main' }))
      .not.toBe(txSyncFingerprint({ ...base, accountId: 'acc_savings' }));
  });

  it('handles missing optional fields', () => {
    const tx = { date: '2026-01-15', amount: 100 };
    expect(txSyncFingerprint(tx)).toBe('2026-01-15|100|||');
  });

  it('trims and lowercases description', () => {
    const a = { date: '2026-01-01', amount: 10, description: '  Grab Food  ', category: 'food', accountId: '' };
    const b = { date: '2026-01-01', amount: 10, description: 'grab food', category: 'food', accountId: '' };
    expect(txSyncFingerprint(a)).toBe(txSyncFingerprint(b));
  });
});
