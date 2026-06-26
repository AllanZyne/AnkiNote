import { openDB } from 'idb';

export function openLocalDb(name = 'ankinote') {
  return openDB(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('decks', { keyPath: 'id' });
        db.createObjectStore('noteTypes', { keyPath: 'id' });
        db.createObjectStore('notes', { keyPath: 'id' });
        db.createObjectStore('outbox', { keyPath: 'opId', autoIncrement: true });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('fileMeta', { keyPath: 'path' });
      }
    },
  });
}
