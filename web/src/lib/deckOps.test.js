import { describe, it, expect } from 'vitest';
import { validateDeckPath, planCreate, planRename, planDelete } from './deckOps.js';

let n = 0;
const makeId = () => `id${++n}`;
const decks = (...names) => names.map((name, i) => ({ id: `d${i}`, name, pinned: false, archived: false }));

describe('deckOps', () => {
  it('validates and normalizes paths', () => {
    expect(validateDeckPath(' A :: B ')).toMatchObject({ valid: true, normalized: 'A::B' });
    expect(validateDeckPath('A::').valid).toBe(false);
  });

  it('planCreate auto-creates missing ancestors leaf-last', () => {
    const { creates } = planCreate([], 'A::B::C', makeId);
    expect(creates.map(c => c.name)).toEqual(['A', 'A::B', 'A::B::C']);
  });

  it('planCreate throws on duplicate', () => {
    expect(() => planCreate(decks('A'), 'A', makeId)).toThrow('deck exists');
  });

  it('planRename rewrites descendants by prefix', () => {
    const ds = decks('Spanish', 'Spanish::Verbs');
    const { renames } = planRename(ds, ds[0].id, 'Language', makeId);
    const byId = Object.fromEntries(renames.map(r => [r.id, r.name]));
    expect(byId[ds[0].id]).toBe('Language');
    expect(byId[ds[1].id]).toBe('Language::Verbs');
  });

  it('planRename merges onto an existing name (renamed row survives)', () => {
    const ds = decks('A', 'B');
    const { merges, renames } = planRename(ds, ds[0].id, 'B', makeId);
    expect(merges).toEqual([{ fromId: ds[1].id, toId: ds[0].id }]);
    expect(renames.find(r => r.id === ds[0].id).name).toBe('B');
  });

  it('planRename rejects moving into own subtree', () => {
    const ds = decks('A');
    expect(() => planRename(ds, ds[0].id, 'A::B', makeId)).toThrow('own subtree');
  });

  it('planDelete includes prefix descendants', () => {
    const ds = decks('A', 'A::B', 'B', 'Other');
    const { deletes } = planDelete(ds, ds[0].id);
    expect(deletes.sort()).toEqual([ds[0].id, ds[1].id].sort()); // A and A::B, NOT B or Other
  });
});
