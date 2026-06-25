import { openDB } from 'idb';

export function openLocalDb(name = 'ankinote') {
  return openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('decks', { keyPath: 'id' });
      db.createObjectStore('noteTypes', { keyPath: 'id' });
      db.createObjectStore('notes', { keyPath: 'id' });
      db.createObjectStore('outbox', { keyPath: 'opId', autoIncrement: true });
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  });
}
