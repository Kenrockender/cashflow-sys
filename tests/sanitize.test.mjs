import { describe, it, expect } from 'vitest';

// Mirror the san() helper from helpers.js
const san = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Mirror the input sanitization from categories.js / accounts.js
const sanitizeInput = raw => (raw || '').replace(/[<>"'&]/g, '').slice(0, 50);

describe('san() HTML escaping', () => {
  it('escapes angle brackets', () => {
    expect(san('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(san('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes double quotes', () => {
    expect(san('" onmouseover="alert(1)"')).toBe('&quot; onmouseover=&quot;alert(1)&quot;');
  });

  it('handles null/undefined', () => {
    expect(san(null)).toBe('');
    expect(san(undefined)).toBe('');
  });

  it('passes clean strings through', () => {
    expect(san('Normal text 123')).toBe('Normal text 123');
  });
});

describe('input sanitization (categories/accounts)', () => {
  it('strips HTML special characters', () => {
    expect(sanitizeInput('<img src=x>')).toBe('img src=x');
  });

  it('strips quotes and ampersands', () => {
    expect(sanitizeInput('Food & "Drink"')).toBe('Food  Drink');
  });

  it('truncates at 50 characters', () => {
    const long = 'A'.repeat(100);
    expect(sanitizeInput(long)).toHaveLength(50);
  });

  it('handles empty input', () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null)).toBe('');
  });
});
