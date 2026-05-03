import { describe, it, expect } from 'vitest';
import { mergeTransactionsAfterQueueFlush } from '../src/utils/lib/mergeTransactions.mjs';

const fp = t => `${t.date}|${Number(t.amount)}|${String(t.description || '').trim().toLowerCase()}`;

describe('mergeTransactionsAfterQueueFlush', () => {
  it('drops offline rows whose fingerprint was synced', () => {
    const fresh = [{ id: 'a1', date: '2026-04-01', amount: 100, description: 'X' }];
    const prev = [
      ...fresh,
      { id: 'offline_1', date: '2026-04-01', amount: 100, description: 'X' },
    ];
    const synced = [fp(prev[1])];
    const out = mergeTransactionsAfterQueueFlush(fresh, prev, synced, fp);
    expect(out.map(t => t.id)).toEqual(['a1']);
  });

  it('keeps offline rows not in synced set when fresh lacks fingerprint', () => {
    const fresh = [{ id: 'a1', date: '2026-04-01', amount: 50, description: 'Y' }];
    const prev = [
      ...fresh,
      { id: 'offline_1', date: '2026-04-02', amount: 200, description: 'Z' },
    ];
    const out = mergeTransactionsAfterQueueFlush(fresh, prev, [], fp);
    expect(out.some(t => t.id === 'offline_1')).toBe(true);
  });
});
