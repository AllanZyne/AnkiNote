import React, { useState } from 'react';

export default function DeckMenu({ deck, onRename, onTogglePin, onToggleArchive, onDelete }) {
  const [open, setOpen] = useState(false);

  const run = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn(deck);
  };

  const toggle = (e) => {
    e.stopPropagation();
    setOpen(v => !v);
  };

  return (
    <span className="deck-menu">
      <button className="deck-menu-trigger" aria-label="Deck menu" onClick={toggle}>⋯</button>
      {open && (
        <div className="deck-menu-list">
          <button onClick={run(onRename)}>Rename</button>
          <button onClick={run(onTogglePin)}>{deck.pinned ? 'Unpin' : 'Pin'}</button>
          <button onClick={run(onToggleArchive)}>{deck.archived ? 'Unarchive' : 'Archive'}</button>
          <button onClick={run(onDelete)}>Delete</button>
        </div>
      )}
    </span>
  );
}
