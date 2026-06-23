import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { createBox, listBoxes, renameBox, deleteBox } from '../boxes.js';

let db;
beforeEach(() => { db = openDb(':memory:'); });

describe('boxes', () => {
  it('creates a top-level box', () => {
    const box = createBox(db, { name: 'Spanish' });
    expect(box).toEqual({ id: expect.any(Number), name: 'Spanish', parentId: null });
  });

  it('creates a nested box and lists all', () => {
    const parent = createBox(db, { name: 'Lang' });
    createBox(db, { name: 'Verbs', parentId: parent.id });
    const all = listBoxes(db);
    expect(all).toHaveLength(2);
    expect(all.find(b => b.name === 'Verbs').parentId).toBe(parent.id);
  });

  it('renames a box', () => {
    const box = createBox(db, { name: 'Old' });
    renameBox(db, box.id, 'New');
    expect(listBoxes(db)[0].name).toBe('New');
  });

  it('deletes a box and cascades to children', () => {
    const parent = createBox(db, { name: 'Lang' });
    createBox(db, { name: 'Verbs', parentId: parent.id });
    deleteBox(db, parent.id);
    expect(listBoxes(db)).toHaveLength(0);
  });
});
