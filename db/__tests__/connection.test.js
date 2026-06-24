import { describe, it, expect } from 'vitest';
import { openDb } from '../connection.js';

describe('openDb', () => {
  it('applies schema so all tables exist', () => {
    const db = openDb(':memory:');
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map(r => r.name);
    expect(rows).toEqual(
      ['card', 'card_template', 'deck', 'field', 'field_value', 'note', 'note_type']
    );
  });

  it('enforces foreign keys', () => {
    const db = openDb(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});
