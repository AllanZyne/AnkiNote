import { describe, it, expect } from 'vitest';
import { serializeDecks, parseDecks, serializeIndex, parseIndex } from './meta.js';

describe('vault meta', () => {
  it('decks round-trip', () => {
    const decks = { 'Spanish': { pinned: true, archived: false }, 'Old': { pinned: false, archived: true } };
    expect(parseDecks(serializeDecks(decks))).toEqual(decks);
  });
  it('parseDecks tolerates empty/invalid', () => {
    expect(parseDecks('')).toEqual({});
    expect(parseDecks('not json')).toEqual({});
  });
  it('index round-trips', () => {
    const index = { notes: { abc: { path: 'Spanish/abc.md', noteType: 'Basic', deck: 'Spanish', title: 'hola', etag: '"e1"', modified: '2026-06-26T10:00:00.000+08:00' } }, generatedAt: '2026-06-26T10:00:00.000+08:00' };
    expect(parseIndex(serializeIndex(index))).toEqual(index);
  });
  it('parseIndex tolerates empty/invalid', () => {
    expect(parseIndex('')).toEqual({ notes: {} });
    expect(parseIndex('xxx')).toEqual({ notes: {} });
  });
});
