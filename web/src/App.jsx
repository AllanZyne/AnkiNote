import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import BoxTree from './components/BoxTree.jsx';
import BrowseView from './components/BrowseView.jsx';
import NoteEditor from './components/NoteEditor.jsx';
import NoteTypeManager from './components/NoteTypeManager.jsx';

export default function App() {
  const [boxes, setBoxes] = useState([]);
  const [noteTypes, setNoteTypes] = useState([]);
  const [activeBox, setActiveBox] = useState(null);
  const [notes, setNotes] = useState([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // {kind, ...}

  const noteTypesById = Object.fromEntries(noteTypes.map(nt => [nt.id, nt]));

  const refreshBoxes = useCallback(async () => setBoxes(await api.listBoxes()), []);
  const refreshNoteTypes = useCallback(async () => setNoteTypes(await api.listNoteTypes()), []);

  const refreshNotes = useCallback(async () => {
    if (query.trim()) setNotes(await api.searchNotes(query));
    else if (activeBox) setNotes(await api.listNotesInBox(activeBox));
    else setNotes([]);
  }, [query, activeBox]);

  useEffect(() => { refreshBoxes(); refreshNoteTypes(); }, [refreshBoxes, refreshNoteTypes]);
  useEffect(() => { refreshNotes(); }, [refreshNotes]);

  const addBox = async () => {
    const name = prompt('Box name:');
    if (name) { await api.createBox({ name, parentId: activeBox }); refreshBoxes(); }
  };

  const saveNote = async (values) => {
    if (modal.note) await api.updateNote(modal.note.id, { values });
    else await api.createNote({ noteTypeId: modal.noteType.id, boxId: activeBox, values });
    setModal(null); refreshNotes();
  };

  const saveNoteType = async (payload) => {
    if (modal.noteType) await api.updateNoteType(modal.noteType.id, payload);
    else await api.createNoteType(payload);
    setModal(null); refreshNoteTypes();
  };

  const startNewNote = () => {
    if (!activeBox) return alert('Select a box first.');
    if (!noteTypes.length) return alert('Create a note type first.');
    setModal({ kind: 'note', noteType: noteTypes[0], note: null });
  };

  const editNote = async (note) => {
    setModal({ kind: 'note', noteType: noteTypesById[note.noteTypeId], note });
  };

  const deleteNote = async (id) => { await api.deleteNote(id); refreshNotes(); };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="toolbar">
          <strong>Boxes</strong>
          <button onClick={addBox}>+</button>
        </div>
        <BoxTree boxes={boxes} activeId={activeBox} onSelect={setActiveBox} />
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
    </div>
  );
}
