import { describe, it, expect } from 'vitest';
import { extractAmountFromText } from '../src/utils/lib/parserAmount.mjs';

describe('extractAmountFromText', () => {
  it('parses Indonesian shorthands', () => {
    expect(extractAmountFromText('nasi goreng 25rb')).toBe(25000);
    expect(extractAmountFromText('gaji 8.5jt')).toBe(8500000);
  });

  it('parses rp prefix', () => {
    expect(extractAmountFromText('Rp 1.500.000')).toBe(1500000);
  });

  it('returns null for empty', () => {
    expect(extractAmountFromText('')).toBeNull();
    expect(extractAmountFromText('   ')).toBeNull();
  });
});
