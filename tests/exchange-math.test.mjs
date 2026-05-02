import { describe, it, expect } from 'vitest';

/**
 * Same convention as open.er / exchangerate.host with base IDR:
 * rates.USD = USD per 1 IDR → IDR per 1 USD = 1 / rates.USD
 */
function idrPerForeignUnit(rates, code) {
  const r = rates[code];
  if (typeof r !== 'number' || r <= 0) return null;
  return Math.round(1 / r);
}

describe('exchange rate math (IDR base)', () => {
  it('converts USD rate', () => {
    const rates = { USD: 0.000063 };
    expect(idrPerForeignUnit(rates, 'USD')).toBe(Math.round(1 / 0.000063));
  });

  it('returns null for missing currency', () => {
    expect(idrPerForeignUnit({ USD: 1 }, 'EUR')).toBeNull();
  });
});
