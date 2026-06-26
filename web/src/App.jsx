import React, { useEffect, useState, useCallback } from 'react';
import { openLocalDb } from './local/db.js';
import { makeRepo } from './local/repo.js';
import { makeProvider } from './storage/index.js';
import { makeVaultSync } from './sync/vaultSync.js';
import { loadSettings, saveSettings } from './settings/store.js';
import { createStarterVault } from './starter.js';
import ConnectDialog from './components/ConnectDialog.jsx';
import DeckTree from './components/DeckTree.jsx';
import BrowseView from './components/BrowseView.jsx';
import NoteEditor from './components/NoteEditor.jsx';
import NoteTypeManager from './components/NoteTypeManager.jsx';
import SyncStatus from './components/SyncStatus.jsx';

export default function App() {
  const [db, setDb] = useState(null);
  const [config, setConfig] = useState(null);     // active provider config
  const [showConnect, setShowConnect] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [boot, setBoot] = useState(null);          // { repo, engine }
  const [decks, setDecks] = useState([]);
  const [noteTypes, setNoteTypes] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [notes, setNotes] = useState([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);

  // engine ref for cleanup on swap/unmount
  const [engineRef] = useState(() => ({ current: null }));
  useEffect(() => () => engineRef.current?.stop(), [engineRef]);

  // cleanup db on unmount
  useEffect(() => () => db?.close(), [db]);

  const connect = useCallback(async (database, cfg) => {
    await saveSettings(database, cfg);
    engineRef.current?.stop();
    const provider = makeProvider(cfg);
    const repo = makeRepo(database);
    const engine = makeVaultSync({ db: database, provider });
    engineRef.current = engine;
    engine.start();
    await engine.syncOnce();
    await createStarterVault(repo);
    setBoot({ repo, engine });
    setConfig(cfg);
  }, []);

  // Always boot a vault: saved provider, else in-memory (and auto-open the dialog first run).
  useEffect(() => {
    let active = true;
    openLocalDb().then(async (database) => {
      if (!active) return;
      setDb(database);
      const saved = await loadSettings(database);
      await connect(database, saved || { type: 'memory' });
      if (!saved) setShowConnect(true);
    });
    return () => { active = false; };
  }, [connect]);

  const onConnect = async (cfg) => {
    setConnectError(null);
    await connect(db, cfg);
    // connect() awaits engine.syncOnce(), which sets the final state before resolving.
    const state = engineRef.current?.getStatus().state;
    if (cfg.type === 'webdav' && (state === 'offline' || state === 'error')) {
      setConnectError("Couldn't reach the vault — the server may be down, or it isn't sending CORS headers for this site. See CORS setup in the README.");
    } else {
      setShowConnect(false);
    }
  };

  const connectLabel = config?.type === 'webdav'
    ? (() => { try { return new URL(config.baseUrl).hostname; } catch { return 'WebDAV'; } })()
    : 'Local-only';

  const noteTypesById = Object.fromEntries(noteTypes.map(nt => [nt.id, nt]));

  const refreshDecks = useCallback(async () => boot && setDecks(await boot.repo.listDecks()), [boot]);
  const refreshNoteTypes = useCallback(async () => boot && setNoteTypes(await boot.repo.listNoteTypes()), [boot]);

  const refreshNotes = useCallback(async () => {
    if (!boot) return;
    if (query.trim()) setNotes(await boot.repo.searchNotes(query));
    else if (activeDeck) setNotes(await boot.repo.listNotesInDeck(activeDeck));
    else setNotes([]);
  }, [query, activeDeck, boot]);

  useEffect(() => { refreshDecks(); refreshNoteTypes(); }, [refreshDecks, refreshNoteTypes]);
  useEffect(() => { refreshNotes(); }, [refreshNotes]);

  const addDeck = async () => {
    const name = prompt('New deck (use :: for sub-decks, e.g. Spanish::Verbs):');
    if (name) {
      await boot.repo.createDeck({ name });
      refreshDecks();
      boot.engine.syncOnce();
    }
  };

  const renameDeck = async (deck) => {
    const name = prompt('Rename deck:', deck.name);
    if (name && name !== deck.name) {
      await boot.repo.renameDeck(deck.id, name);
      refreshDecks();
      boot.engine.syncOnce();
    }
  };

  const togglePin = async (deck) => {
    await boot.repo.updateDeck(deck.id, { pinned: !deck.pinned });
    refreshDecks();
    boot.engine.syncOnce();
  };

  const toggleArchive = async (deck) => {
    await boot.repo.updateDeck(deck.id, { archived: !deck.archived });
    refreshDecks();
    boot.engine.syncOnce();
  };

  const removeDeck = async (deck) => {
    if (!confirm(`Delete deck "${deck.name}" and all its sub-decks and notes?`)) return;
    await boot.repo.deleteDeck(deck.id);
    if (activeDeck === deck.id) setActiveDeck(null);
    refreshDecks();
    boot.engine.syncOnce();
  };

  const saveNote = async (values) => {
    if (modal.note) await boot.repo.updateNote(modal.note.id, { values });
    else await boot.repo.createNote({ noteTypeId: modal.noteType.id, deckId: activeDeck, values });
    setModal(null);
    refreshNotes();
    boot.engine.syncOnce();
  };

  const saveNoteType = async (payload) => {
    if (modal.noteType) await boot.repo.updateNoteType(modal.noteType.id, payload);
    else await boot.repo.createNoteType(payload);
    setModal(null);
    refreshNoteTypes();
    boot.engine.syncOnce();
  };

  const startNewNote = () => {
    if (!activeDeck) return alert('Select a deck first.');
    if (!noteTypes.length) return alert('Create a note type first.');
    setModal({ kind: 'note', noteType: noteTypes[0], note: null });
  };

  const editNote = async (note) => {
    setModal({ kind: 'note', noteType: noteTypesById[note.noteTypeId], note });
  };

  const deleteNote = async (id) => {
    await boot.repo.deleteNote(id);
    refreshNotes();
    boot.engine.syncOnce();
  };

  if (!boot) return <div className="app">Loading…</div>;

  return (
    <div className="app">
      <div className="sidebar">
        <div className="toolbar">
          <strong>Decks</strong>
          <button onClick={addDeck}>+</button>
        </div>
        <DeckTree
          decks={decks}
          activeId={activeDeck}
          onSelect={setActiveDeck}
          onRename={renameDeck}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onDelete={removeDeck}
        />
        <hr />
        <button onClick={() => setModal({ kind: 'noteType', noteType: null })}>
          Manage note types
        </button>
      </div>

      <div className="main">
        <div className="toolbar">
          <button onClick={startNewNote}>New note</button>
          <input type="search" placeholder="Search cards…"
            value={query} onChange={e => setQuery(e.target.value)} />
          <SyncStatus engine={boot.engine} />
          <button className="connect-toggle" onClick={() => setShowConnect(true)}>{connectLabel}</button>
        </div>

        <BrowseView notes={notes} noteTypesById={noteTypesById}
          onEdit={editNote} onDelete={deleteNote} />
      </div>

      {modal?.kind === 'note' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <NoteEditor
              noteType={modal.noteType}
              initialValues={modal.note?.values ?? {}}
              onSubmit={saveNote}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {modal?.kind === 'noteType' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <NoteTypeManager
              initial={modal.noteType}
              onSave={saveNoteType}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {showConnect && (
        <ConnectDialog onConnect={onConnect} onClose={() => setShowConnect(false)}
          error={connectError} initial={config} />
      )}
    </div>
  );
}
