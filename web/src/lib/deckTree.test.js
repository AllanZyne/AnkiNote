import { describe, it, expect } from 'vitest';
import { buildDeckTree } from './deckTree.js';

const d = (id, name, extra = {}) => ({ id, name, pinned: false, archived: false, ...extra });

describe('buildDeckTree', () => {
  it('nests decks by :: and labels by segment', () => {
    const tree = buildDeckTree([d(1, 'Spanish'), d(2, 'Spanish::Verbs')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].segment).toBe('Spanish');
    expect(tree[0].deck.id).toBe(1);
    expect(tree[0].children[0].segment).toBe('Verbs');
    expect(tree[0].children[0].deck.id).toBe(2);
  });

  it('synthesizes a virtual intermediate when no row exists for it', () => {
    const tree = buildDeckTree([d(2, 'Spanish::Verbs')]);
    expect(tree[0].segment).toBe('Spanish');
    expect(tree[0].deck).toBeNull();
    expect(tree[0].children[0].deck.id).toBe(2);
  });

  it('sorts siblings pinned-first, archived-last, then by name', () => {
    const tree = buildDeckTree([
      d(1, 'Bravo'), d(2, 'Alpha', { archived: true }),
      d(3, 'Charlie', { pinned: true }), d(4, 'Delta'),
    ]);
    expect(tree.map(n => n.segment)).toEqual(['Charlie', 'Bravo', 'Delta', 'Alpha']);
  });
});
