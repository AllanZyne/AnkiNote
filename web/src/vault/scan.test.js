import { describe, it, expect } from 'vitest';
import { makeMemoryProvider } from '../storage/memory.js';
import { scanVault } from './scan.js';

describe('scanVault', () => {
  it('returns all files recursively', async () => {
    const p = makeMemoryProvider({
      'Spanish/a.md': '1',
      'Spanish/Verbs/b.md': '2',
      '.ankinote/decks.json': '{}',
      '.ankinote/note-types/Basic.md': 'x',
    });
    const files = (await scanVault(p)).map(f => f.path).sort();
    expect(files).toEqual([
      '.ankinote/decks.json', '.ankinote/note-types/Basic.md', 'Spanish/Verbs/b.md', 'Spanish/a.md',
    ].sort());
  });

  it('returns [] for an empty vault', async () => {
    expect(await scanVault(makeMemoryProvider())).toEqual([]);
  });
});
