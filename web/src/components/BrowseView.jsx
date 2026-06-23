import React from 'react';
import Card from './Card.jsx';

export default function BrowseView({ notes, noteTypesById, onEdit, onDelete }) {
  if (!notes.length) return <p>No cards yet.</p>;
  return (
    <div className="card-grid">
      {notes.map(note => {
        const nt = noteTypesById[note.noteTypeId];
        if (!nt) return null;
        return (
          <div key={note.id}>
            <Card noteType={nt} template={nt.templates[0]} values={note.values} />
            <div className="toolbar" style={{ marginTop: 6 }}>
              <button onClick={() => onEdit(note)}>Edit</button>
              <button onClick={() => onDelete(note.id)}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
