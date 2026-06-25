import { describe, it, expect } from 'vitest';
import { nowIso, toInstant } from './clock.js';

describe('clock', () => {
  it('nowIso has a timezone offset and parses', () => {
    const s = nowIso();
    expect(s).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(Number.isNaN(Date.parse(s))).toBe(false);
  });
  it('toInstant compares absolute instants across offsets', () => {
    expect(toInstant('2026-06-25T12:00:00.000+00:00')).toBe(toInstant('2026-06-25T20:00:00.000+08:00'));
    expect(toInstant('2026-06-25T12:00:01.000+00:00')).toBeGreaterThan(toInstant('2026-06-25T12:00:00.000+00:00'));
  });
});
