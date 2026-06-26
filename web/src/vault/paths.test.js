import { describe, it, expect } from 'vitest';
import { deckPathToDir, dirToDeckPath, noteFilePath, noteTypePath, isAnkinotePath, INDEX_PATH } from './paths.js';

describe('vault paths', () => {
  it('maps deck path <-> dir', () => {
    expect(deckPathToDir('Spanish::Verbs')).toBe('Spanish/Verbs');
    expect(dirToDeckPath('Spanish/Verbs')).toBe('Spanish::Verbs');
    expect(deckPathToDir('')).toBe('');
    expect(dirToDeckPath('')).toBe('');
  });
  it('builds a note file path under its deck folder', () => {
    expect(noteFilePath('Spanish::Verbs', 'abc')).toBe('Spanish/Verbs/abc.md');
    expect(noteFilePath('', 'abc')).toBe('abc.md');
  });
  it('builds note-type and index paths', () => {
    expect(noteTypePath('Basic')).toBe('.ankinote/note-types/Basic.md');
    expect(INDEX_PATH).toBe('.ankinote/index.json');
  });
  it('detects .ankinote paths', () => {
    expect(isAnkinotePath('.ankinote/decks.json')).toBe(true);
    expect(isAnkinotePath('Spanish/x.md')).toBe(false);
  });
});
