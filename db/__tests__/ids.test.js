import { describe, it, expect } from 'vitest';
import { newId, nowIso, toInstant } from '../ids.js';

describe('ids', () => {
  it('newId returns distinct uuid strings', () => {
    const a = newId(), b = newId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it('nowIso carries a timezone offset (not Z)', () => {
    const s = nowIso();
    expect(s).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(Number.isNaN(Date.parse(s))).toBe(false);
  });

  it('toInstant compares absolute instants across offsets', () => {
    // same instant, different offsets -> equal
    expect(toInstant('2026-06-25T12:00:00.000+00:00'))
      .toBe(toInstant('2026-06-25T20:00:00.000+08:00'));
    expect(toInstant('2026-06-25T12:00:01.000+00:00'))
      .toBeGreaterThan(toInstant('2026-06-25T12:00:00.000+00:00'));
  });
});
