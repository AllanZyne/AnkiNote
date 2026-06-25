import { describe, it, expect } from 'vitest';
import { openLocalDb } from './db.js';

describe('openLocalDb', () => {
  it('creates the expected object stores', async () => {
    const db = await openLocalDb();
    const names = Array.from(db.objectStoreNames).sort();
    expect(names).toEqual(['decks', 'meta', 'noteTypes', 'notes', 'outbox']);
    db.close();
  });
});
