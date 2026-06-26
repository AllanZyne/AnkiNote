import { describe, it, expect, beforeEach } from 'vitest';
import { openLocalDb } from '../local/db.js';
import { loadSettings, saveSettings } from './store.js';

let db;
beforeEach(async () => { db = await openLocalDb(`ankinote-settings-${Date.now()}-${Math.random()}`); });

describe('settings store', () => {
  it('returns null when unset', async () => { expect(await loadSettings(db)).toBeNull(); });
  it('round-trips a config', async () => {
    await saveSettings(db, { type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic x' });
    expect(await loadSettings(db)).toMatchObject({ type: 'webdav', baseUrl: 'https://d/dav' });
  });
});
